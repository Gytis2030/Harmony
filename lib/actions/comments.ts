'use server'

import { auth } from '@clerk/nextjs/server'
import { and, eq, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { getUserByClerkId } from '@/lib/db/queries/users'
import { getCommentsForProject } from '@/lib/db/queries/comments'
import { getProjectByIdWithShareGrant } from '@/lib/db/queries/projects'
import {
  commentReplies,
  comments,
  projects,
  projectShareGrants,
  tracks,
  users,
  workspaceMembers,
} from '@/lib/db/schema'

export type CommentReplyDto = {
  id: string
  commentId: string
  authorUserId: string
  authorName: string
  body: string
  createdAt: string
  updatedAt: string
}

export type CommentDto = {
  id: string
  projectId: string
  trackId: string | null
  trackName: string | null
  authorUserId: string
  authorName: string
  timestampSeconds: number
  timeRangeStartSeconds: number | null
  timeRangeEndSeconds: number | null
  body: string
  status: 'open' | 'resolved'
  isPinned: boolean
  createdAt: string
  updatedAt: string
  replies: CommentReplyDto[]
}

async function requireUser() {
  const { userId: clerkId } = auth()
  if (!clerkId) throw new Error('Unauthorized')

  const user = await getUserByClerkId(clerkId)
  if (!user) throw new Error('User not found')

  return user
}

// Allows workspace owner/editor/commenter OR share-grant users with 'comment' access.
// Viewers (workspace role) cannot comment. Used for createComment and createCommentReply.
async function requireCommentPermission(projectId: string, userId: string) {
  // Workspace member check — exclude viewers
  const [memberRow] = await db
    .select({ workspaceId: projects.workspaceId, role: workspaceMembers.role })
    .from(projects)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, projects.workspaceId))
    .where(
      and(
        eq(projects.id, projectId),
        eq(workspaceMembers.userId, userId),
        isNull(projects.deletedAt)
      )
    )
    .limit(1)

  if (memberRow && memberRow.role !== 'viewer') return

  // Share-grant with comment access
  const [grantRow] = await db
    .select({ accessLevel: projectShareGrants.accessLevel })
    .from(projectShareGrants)
    .innerJoin(projects, eq(projects.id, projectShareGrants.projectId))
    .where(
      and(
        eq(projectShareGrants.projectId, projectId),
        eq(projectShareGrants.userId, userId),
        eq(projectShareGrants.accessLevel, 'comment'),
        isNull(projects.deletedAt)
      )
    )
    .limit(1)

  if (grantRow) return

  throw new Error('Forbidden')
}

function toDto(row: {
  id: string
  projectId: string
  trackId: string | null
  trackName: string | null
  authorUserId: string
  authorName: string | null
  authorEmail: string
  timestampSeconds: number
  timeRangeStartSeconds: number | null
  timeRangeEndSeconds: number | null
  body: string
  status: 'open' | 'resolved'
  isPinned: boolean
  createdAt: Date
  updatedAt: Date
}): CommentDto {
  return {
    id: row.id,
    projectId: row.projectId,
    trackId: row.trackId,
    trackName: row.trackName,
    authorUserId: row.authorUserId,
    authorName: row.authorName ?? row.authorEmail,
    timestampSeconds: row.timestampSeconds,
    timeRangeStartSeconds: row.timeRangeStartSeconds,
    timeRangeEndSeconds: row.timeRangeEndSeconds,
    body: row.body,
    status: row.status,
    isPinned: row.isPinned,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    replies: [],
  }
}

function replyToDto(row: {
  id: string
  commentId: string
  authorUserId: string
  authorName: string | null
  authorEmail: string
  body: string
  createdAt: Date
  updatedAt: Date
}): CommentReplyDto {
  return {
    id: row.id,
    commentId: row.commentId,
    authorUserId: row.authorUserId,
    authorName: row.authorName ?? row.authorEmail,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function createComment(params: {
  projectId: string
  trackId?: string | null
  timestampSeconds: number
  body: string
}) {
  const user = await requireUser()
  await requireCommentPermission(params.projectId, user.id)

  const body = params.body.trim()
  if (!body) throw new Error('Comment is required.')
  if (body.length > 2000) throw new Error('Comment must be 2000 characters or fewer.')
  if (!Number.isFinite(params.timestampSeconds) || params.timestampSeconds < 0) {
    throw new Error('Timestamp must be a positive number.')
  }

  let trackName: string | null = null
  if (params.trackId) {
    const [track] = await db
      .select({ projectId: tracks.projectId, name: tracks.name })
      .from(tracks)
      .where(eq(tracks.id, params.trackId))
      .limit(1)

    if (!track || track.projectId !== params.projectId) {
      throw new Error('Track not found in this project.')
    }
    trackName = track.name
  }

  const [comment] = await db
    .insert(comments)
    .values({
      projectId: params.projectId,
      trackId: params.trackId ?? null,
      authorUserId: user.id,
      timestampSeconds: params.timestampSeconds,
      body,
    })
    .returning({
      id: comments.id,
      projectId: comments.projectId,
      trackId: comments.trackId,
      authorUserId: comments.authorUserId,
      timestampSeconds: comments.timestampSeconds,
      timeRangeStartSeconds: comments.timeRangeStartSeconds,
      timeRangeEndSeconds: comments.timeRangeEndSeconds,
      body: comments.body,
      status: comments.status,
      isPinned: comments.isPinned,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
    })

  revalidatePath(`/projects/${params.projectId}`)

  return toDto({
    ...comment,
    trackName,
    authorName: user.displayName,
    authorEmail: user.email,
  })
}

export async function setCommentStatus(params: { commentId: string; status: 'open' | 'resolved' }) {
  const user = await requireUser()

  const [comment] = await db
    .select({
      projectId: comments.projectId,
      workspaceId: projects.workspaceId,
    })
    .from(comments)
    .innerJoin(projects, eq(projects.id, comments.projectId))
    .where(and(eq(comments.id, params.commentId), isNull(projects.deletedAt)))
    .limit(1)

  if (!comment) throw new Error('Comment not found')

  const [membership] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, comment.workspaceId),
        eq(workspaceMembers.userId, user.id)
      )
    )
    .limit(1)

  if (!membership || (membership.role !== 'owner' && membership.role !== 'editor')) {
    throw new Error('Forbidden')
  }

  const [updated] = await db
    .update(comments)
    .set({ status: params.status, updatedAt: new Date() })
    .where(eq(comments.id, params.commentId))
    .returning({
      id: comments.id,
      projectId: comments.projectId,
      trackId: comments.trackId,
      trackName: comments.trackId,
      authorUserId: comments.authorUserId,
      timestampSeconds: comments.timestampSeconds,
      timeRangeStartSeconds: comments.timeRangeStartSeconds,
      timeRangeEndSeconds: comments.timeRangeEndSeconds,
      body: comments.body,
      status: comments.status,
      isPinned: comments.isPinned,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
    })

  const [author] = await db
    .select({ displayName: users.displayName, email: users.email })
    .from(users)
    .where(eq(users.id, updated.authorUserId))
    .limit(1)

  let trackName: string | null = null
  if (updated.trackId) {
    const [track] = await db
      .select({ name: tracks.name })
      .from(tracks)
      .where(eq(tracks.id, updated.trackId))
      .limit(1)
    trackName = track?.name ?? null
  }

  revalidatePath(`/projects/${comment.projectId}`)

  return toDto({
    ...updated,
    trackName,
    authorName: author?.displayName ?? null,
    authorEmail: author?.email ?? 'Unknown collaborator',
  })
}

export async function setCommentPinned(params: { commentId: string; isPinned: boolean }) {
  const user = await requireUser()

  const [comment] = await db
    .select({
      projectId: comments.projectId,
      workspaceId: projects.workspaceId,
    })
    .from(comments)
    .innerJoin(projects, eq(projects.id, comments.projectId))
    .where(and(eq(comments.id, params.commentId), isNull(projects.deletedAt)))
    .limit(1)

  if (!comment) throw new Error('Comment not found')

  const [membership] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, comment.workspaceId),
        eq(workspaceMembers.userId, user.id)
      )
    )
    .limit(1)

  if (!membership || (membership.role !== 'owner' && membership.role !== 'editor')) {
    throw new Error('Forbidden')
  }

  const [updated] = await db
    .update(comments)
    .set({ isPinned: params.isPinned, updatedAt: new Date() })
    .where(eq(comments.id, params.commentId))
    .returning({
      id: comments.id,
      projectId: comments.projectId,
      trackId: comments.trackId,
      trackName: comments.trackId,
      authorUserId: comments.authorUserId,
      timestampSeconds: comments.timestampSeconds,
      timeRangeStartSeconds: comments.timeRangeStartSeconds,
      timeRangeEndSeconds: comments.timeRangeEndSeconds,
      body: comments.body,
      status: comments.status,
      isPinned: comments.isPinned,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
    })

  const [author] = await db
    .select({ displayName: users.displayName, email: users.email })
    .from(users)
    .where(eq(users.id, updated.authorUserId))
    .limit(1)

  let trackName: string | null = null
  if (updated.trackId) {
    const [track] = await db
      .select({ name: tracks.name })
      .from(tracks)
      .where(eq(tracks.id, updated.trackId))
      .limit(1)
    trackName = track?.name ?? null
  }

  revalidatePath(`/projects/${comment.projectId}`)

  return toDto({
    ...updated,
    trackName,
    authorName: author?.displayName ?? null,
    authorEmail: author?.email ?? 'Unknown collaborator',
  })
}

export async function deleteComment(commentId: string) {
  const user = await requireUser()

  const [comment] = await db
    .select({
      projectId: comments.projectId,
      workspaceId: projects.workspaceId,
    })
    .from(comments)
    .innerJoin(projects, eq(projects.id, comments.projectId))
    .where(and(eq(comments.id, commentId), isNull(projects.deletedAt)))
    .limit(1)

  if (!comment) throw new Error('Comment not found')

  const [membership] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, comment.workspaceId),
        eq(workspaceMembers.userId, user.id)
      )
    )
    .limit(1)

  if (!membership || (membership.role !== 'owner' && membership.role !== 'editor')) {
    throw new Error('Forbidden')
  }

  await db.delete(comments).where(eq(comments.id, commentId))
  revalidatePath(`/projects/${comment.projectId}`)

  return { id: commentId }
}

export async function createCommentReply(params: { commentId: string; body: string }) {
  const user = await requireUser()

  const body = params.body.trim()
  if (!body) throw new Error('Reply is required.')
  if (body.length > 2000) throw new Error('Reply must be 2000 characters or fewer.')

  const [comment] = await db
    .select({
      projectId: comments.projectId,
      workspaceId: projects.workspaceId,
    })
    .from(comments)
    .innerJoin(projects, eq(projects.id, comments.projectId))
    .where(and(eq(comments.id, params.commentId), isNull(projects.deletedAt)))
    .limit(1)

  if (!comment) throw new Error('Comment not found')

  await requireCommentPermission(comment.projectId, user.id)

  const [reply] = await db
    .insert(commentReplies)
    .values({
      commentId: params.commentId,
      authorUserId: user.id,
      body,
    })
    .returning({
      id: commentReplies.id,
      commentId: commentReplies.commentId,
      authorUserId: commentReplies.authorUserId,
      body: commentReplies.body,
      createdAt: commentReplies.createdAt,
      updatedAt: commentReplies.updatedAt,
    })

  revalidatePath(`/projects/${comment.projectId}`)

  return replyToDto({
    ...reply,
    authorName: user.displayName,
    authorEmail: user.email,
  })
}

// Used by the client-side Liveblocks event listener to re-sync after a remote
// comment change. Returns the current DB state — callers replace local state
// with this result rather than applying a partial patch.
export async function fetchProjectComments(projectId: string): Promise<CommentDto[]> {
  const user = await requireUser()
  // Access check is done inside getCommentsForProject (workspace member OR share grant)
  const accessible = await getProjectByIdWithShareGrant(projectId, user.id)
  if (!accessible) throw new Error('Forbidden')

  const rawComments = await getCommentsForProject(projectId, user.id)

  return rawComments.map((comment) => ({
    id: comment.id,
    projectId: comment.projectId,
    trackId: comment.trackId,
    trackName: comment.trackName,
    authorUserId: comment.authorUserId,
    authorName: comment.authorName,
    timestampSeconds: comment.timestampSeconds,
    timeRangeStartSeconds: comment.timeRangeStartSeconds,
    timeRangeEndSeconds: comment.timeRangeEndSeconds,
    body: comment.body,
    status: comment.status,
    isPinned: comment.isPinned,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
    replies: comment.replies.map((reply) => ({
      id: reply.id,
      commentId: reply.commentId,
      authorUserId: reply.authorUserId,
      authorName: reply.authorName,
      body: reply.body,
      createdAt: reply.createdAt.toISOString(),
      updatedAt: reply.updatedAt.toISOString(),
    })),
  }))
}
