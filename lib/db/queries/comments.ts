import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '../index'
import { commentReplies, comments, projects, tracks, users } from '../schema'
import { getProjectByIdWithShareGrant } from './projects'

export type ProjectCommentReply = {
  id: string
  commentId: string
  authorUserId: string
  authorName: string
  body: string
  createdAt: Date
  updatedAt: Date
}

export type ProjectComment = {
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
  createdAt: Date
  updatedAt: Date
  replies: ProjectCommentReply[]
}

export async function getCommentsForProject(
  projectId: string,
  userId: string
): Promise<ProjectComment[]> {
  // Access check: workspace member OR share-grant user
  const accessible = await getProjectByIdWithShareGrant(projectId, userId)
  if (!accessible) return []

  const rows = await db
    .select({
      id: comments.id,
      projectId: comments.projectId,
      trackId: comments.trackId,
      trackName: tracks.name,
      authorUserId: comments.authorUserId,
      authorName: users.displayName,
      authorEmail: users.email,
      timestampSeconds: comments.timestampSeconds,
      timeRangeStartSeconds: comments.timeRangeStartSeconds,
      timeRangeEndSeconds: comments.timeRangeEndSeconds,
      body: comments.body,
      status: comments.status,
      isPinned: comments.isPinned,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
    })
    .from(comments)
    .innerJoin(projects, eq(projects.id, comments.projectId))
    .innerJoin(users, eq(users.id, comments.authorUserId))
    .leftJoin(tracks, eq(tracks.id, comments.trackId))
    .where(and(eq(comments.projectId, projectId), isNull(projects.deletedAt)))
    .orderBy(asc(comments.timestampSeconds), asc(comments.createdAt))

  if (rows.length === 0) return []

  const replies = await db
    .select({
      id: commentReplies.id,
      commentId: commentReplies.commentId,
      authorUserId: commentReplies.authorUserId,
      authorName: users.displayName,
      authorEmail: users.email,
      body: commentReplies.body,
      createdAt: commentReplies.createdAt,
      updatedAt: commentReplies.updatedAt,
    })
    .from(commentReplies)
    .innerJoin(users, eq(users.id, commentReplies.authorUserId))
    .where(
      inArray(
        commentReplies.commentId,
        rows.map((row) => row.id)
      )
    )
    .orderBy(asc(commentReplies.createdAt))

  const repliesByCommentId = new Map<string, ProjectCommentReply[]>()
  for (const reply of replies) {
    const commentRepliesForId = repliesByCommentId.get(reply.commentId) ?? []
    commentRepliesForId.push({
      ...reply,
      authorName: reply.authorName ?? reply.authorEmail,
    })
    repliesByCommentId.set(reply.commentId, commentRepliesForId)
  }

  return rows.map((row) => ({
    ...row,
    authorName: row.authorName ?? row.authorEmail,
    replies: repliesByCommentId.get(row.id) ?? [],
  }))
}
