'use server'

import { auth } from '@clerk/nextjs/server'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { getUserByClerkId } from '@/lib/db/queries/users'
import { getTracksForProject } from '@/lib/db/queries/tracks'
import { recordActivity } from '@/lib/db/queries/activity'
import {
  projects,
  projectVersions,
  projectVersionTracks,
  tracks,
  users,
  workspaceMembers,
} from '@/lib/db/schema'

export type VersionDto = {
  id: string
  projectId: string
  name: string
  description: string | null
  projectTitle: string
  createdBy: string
  creatorName: string
  createdAt: string
}

async function requireUser() {
  const { userId: clerkId } = auth()
  if (!clerkId) throw new Error('Unauthorized')
  const user = await getUserByClerkId(clerkId)
  if (!user) throw new Error('User not found')
  return user
}

async function requireProjectMembership(projectId: string, userId: string) {
  const [row] = await db
    .select({ workspaceId: projects.workspaceId, name: projects.name, role: workspaceMembers.role })
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

  if (!row) throw new Error('Forbidden')
  return row
}

async function createVersionInternal(
  params: { projectId: string; name: string; description?: string },
  user: { id: string; displayName: string | null; email: string },
  project: { name: string; role: string },
  skipActivity = false
): Promise<VersionDto> {
  const name = params.name.trim()
  if (!name) throw new Error('Version name is required.')
  if (name.length > 200) throw new Error('Version name must be 200 characters or fewer.')

  const currentTracks = await getTracksForProject(params.projectId)
  const description = params.description?.trim() || null

  const version = await db.transaction(async (tx) => {
    const [v] = await tx
      .insert(projectVersions)
      .values({
        projectId: params.projectId,
        createdBy: user.id,
        name,
        description,
        projectTitle: project.name,
      })
      .returning({ id: projectVersions.id, createdAt: projectVersions.createdAt })

    if (currentTracks.length > 0) {
      await tx.insert(projectVersionTracks).values(
        currentTracks.map((t) => ({
          versionId: v.id,
          trackId: t.id,
          name: t.name,
          position: t.position,
          volume: t.volume,
          isMuted: t.isMuted,
          isSoloed: t.isSoloed,
          color: t.color,
          r2Key: t.audioFile?.r2Key ?? null,
          originalFilename: t.audioFile?.originalFilename ?? null,
          durationSeconds: t.audioFile?.durationSeconds ?? null,
        }))
      )
    }

    return v
  })

  if (!skipActivity) {
    await recordActivity({
      projectId: params.projectId,
      actorUserId: user.id,
      type: 'version.created',
      targetType: 'version',
      targetId: version.id,
      metadata: { versionName: name },
    })
  }

  return {
    id: version.id,
    projectId: params.projectId,
    name,
    description,
    projectTitle: project.name,
    createdBy: user.id,
    creatorName: user.displayName ?? user.email,
    createdAt: version.createdAt.toISOString(),
  }
}

export async function createVersion(params: {
  projectId: string
  name: string
  description?: string
}): Promise<VersionDto> {
  const user = await requireUser()
  const project = await requireProjectMembership(params.projectId, user.id)
  if (project.role !== 'owner' && project.role !== 'editor') throw new Error('Forbidden')

  return createVersionInternal(params, user, project)
}

export type RestoredTrackMix = {
  id: string
  volume: number
  isMuted: boolean
  isSoloed: boolean
}

export type RestoreResult = {
  safetySnapshot: VersionDto
  restoredCount: number
  restoredTracks: RestoredTrackMix[]
}

export async function restoreVersion(params: {
  versionId: string
  projectId: string
}): Promise<RestoreResult> {
  const user = await requireUser()
  const project = await requireProjectMembership(params.projectId, user.id)
  if (project.role !== 'owner' && project.role !== 'editor') throw new Error('Forbidden')

  const [version] = await db
    .select({ id: projectVersions.id, name: projectVersions.name })
    .from(projectVersions)
    .where(
      and(eq(projectVersions.id, params.versionId), eq(projectVersions.projectId, params.projectId))
    )
    .limit(1)

  if (!version) throw new Error('Version not found.')

  const versionTracks = await db
    .select()
    .from(projectVersionTracks)
    .where(eq(projectVersionTracks.versionId, params.versionId))

  // Snapshot current state BEFORE overwriting it (skip activity — the restore event covers it).
  const safetySnapshot = await createVersionInternal(
    { projectId: params.projectId, name: `Before restoring: ${version.name}` },
    user,
    project,
    true
  )

  let restoredCount = 0
  const restoredTracks: RestoredTrackMix[] = []

  if (versionTracks.length > 0) {
    await db.transaction(async (tx) => {
      for (const vt of versionTracks) {
        if (!vt.trackId) continue
        const updated = await tx
          .update(tracks)
          .set({
            name: vt.name,
            position: vt.position,
            volume: vt.volume,
            isMuted: vt.isMuted,
            isSoloed: vt.isSoloed,
            color: vt.color,
            updatedAt: new Date(),
          })
          .where(and(eq(tracks.id, vt.trackId), eq(tracks.projectId, params.projectId)))
          .returning({ id: tracks.id })
        if (updated.length > 0) {
          restoredCount++
          restoredTracks.push({
            id: vt.trackId,
            volume: vt.volume,
            isMuted: vt.isMuted,
            isSoloed: vt.isSoloed,
          })
        }
      }
    })
  }

  await recordActivity({
    projectId: params.projectId,
    actorUserId: user.id,
    type: 'version.restored',
    targetType: 'version',
    targetId: params.versionId,
    metadata: { versionName: version.name },
  })

  revalidatePath(`/projects/${params.projectId}`)

  return { safetySnapshot, restoredCount, restoredTracks }
}

// Client-callable fetch for real-time version refresh. Accepts both workspace
// members and share-grant users (mirrors the comment fetch pattern).
export async function fetchProjectVersions(projectId: string): Promise<VersionDto[]> {
  const user = await requireUser()

  // Workspace member OR share grant access.
  const { getProjectByIdWithShareGrant } = await import('@/lib/db/queries/projects')
  const accessible = await getProjectByIdWithShareGrant(projectId, user.id)
  if (!accessible) throw new Error('Forbidden')

  return listVersionsInternal(projectId)
}

async function listVersionsInternal(projectId: string): Promise<VersionDto[]> {
  const rows = await db
    .select({
      id: projectVersions.id,
      projectId: projectVersions.projectId,
      name: projectVersions.name,
      description: projectVersions.description,
      projectTitle: projectVersions.projectTitle,
      createdBy: projectVersions.createdBy,
      creatorName: users.displayName,
      creatorEmail: users.email,
      createdAt: projectVersions.createdAt,
    })
    .from(projectVersions)
    .innerJoin(users, eq(users.id, projectVersions.createdBy))
    .where(eq(projectVersions.projectId, projectId))
    .orderBy(desc(projectVersions.createdAt))

  return rows.map((r) => ({
    id: r.id,
    projectId: r.projectId,
    name: r.name,
    description: r.description,
    projectTitle: r.projectTitle,
    createdBy: r.createdBy,
    creatorName: r.creatorName ?? r.creatorEmail,
    createdAt: r.createdAt.toISOString(),
  }))
}

export async function listVersions(projectId: string): Promise<VersionDto[]> {
  const user = await requireUser()
  await requireProjectMembership(projectId, user.id)
  return listVersionsInternal(projectId)
}
