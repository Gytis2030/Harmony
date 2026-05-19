'use server'

import { auth } from '@clerk/nextjs/server'
import { and, eq, max, ne, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { getUserByClerkId } from '@/lib/db/queries/users'
import {
  audioFiles,
  comments,
  projectVersionTracks,
  projects,
  tracks,
  workspaceMembers,
} from '@/lib/db/schema'
import { recordActivity } from '@/lib/db/queries/activity'

export type CreatedTrack = {
  id: string
  name: string
  volume: number
  isMuted: boolean
  isSoloed: boolean
  color: null
  audioFile: {
    id: string
    originalFilename: string
    sizeBytes: number
    durationSeconds: null
  }
}

export async function addTrack(params: {
  r2Key: string
  filename: string
  mimeType: string
  sizeBytes: number
  projectId: string
}): Promise<CreatedTrack> {
  const { userId: clerkId } = auth()
  if (!clerkId) throw new Error('Unauthorized')

  const user = await getUserByClerkId(clerkId)
  if (!user) throw new Error('User not found')

  // Verify the user is a member of the project's workspace.
  const [project] = await db
    .select({ workspaceId: projects.workspaceId })
    .from(projects)
    .where(eq(projects.id, params.projectId))
    .limit(1)

  if (!project) throw new Error('Project not found')

  const [membership] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, project.workspaceId),
        eq(workspaceMembers.userId, user.id)
      )
    )
    .limit(1)

  if (!membership || (membership.role !== 'owner' && membership.role !== 'editor')) {
    throw new Error('Forbidden')
  }

  // Use MAX(position)+1 so deleted tracks don't collapse the sequence.
  const [posRow] = await db
    .select({ maxPos: max(tracks.position) })
    .from(tracks)
    .where(eq(tracks.projectId, params.projectId))

  const position = (posRow?.maxPos ?? 0) + 1
  const trackName = params.filename.replace(/\.[^.]+$/, '')

  // Single-statement CTE — both inserts are atomic without BEGIN/COMMIT round-trips.
  // Using db.transaction() with pgbouncer TRANSACTION mode sends 4 separate messages
  // (BEGIN, INSERT, INSERT, COMMIT); pgbouncer can reassign the connection between them
  // under load, silently rolling back the transaction while postgres.js resolves normally.
  const rows = await db.execute(
    sql`WITH new_track AS (
      INSERT INTO tracks (project_id, name, position)
      VALUES (${params.projectId}::uuid, ${trackName}, ${position})
      RETURNING id
    ), new_audio AS (
      INSERT INTO audio_files (track_id, uploaded_by, r2_key, original_filename, mime_type, size_bytes)
      SELECT id, ${user.id}::uuid, ${params.r2Key}, ${params.filename}, ${params.mimeType}, ${params.sizeBytes}::bigint
      FROM new_track
      RETURNING id
    )
    SELECT new_track.id AS track_id, new_audio.id AS audio_file_id
    FROM new_track, new_audio`
  )

  const insertedRow = rows[0] as { track_id: string; audio_file_id: string } | undefined
  if (!insertedRow) throw new Error('Track insert failed')
  const trackId = insertedRow.track_id
  const audioFileId = insertedRow.audio_file_id
  // Activity recording is non-critical; a failure here must not lose the track.
  await recordActivity({
    projectId: params.projectId,
    actorUserId: user.id,
    type: 'track.uploaded',
    metadata: { trackName, filename: params.filename },
  }).catch(() => {})

  // Intentionally no revalidatePath here — the caller updates UI optimistically via
  // handleTrackCreated. Revalidating from inside a concurrent batch upload causes
  // Next.js to re-render the RSC after each action, and the resulting snapshots race
  // with one another, making newly-added tracks disappear.

  return {
    id: trackId,
    name: trackName,
    volume: 1.0,
    isMuted: false,
    isSoloed: false,
    color: null,
    audioFile: {
      id: audioFileId,
      originalFilename: params.filename,
      sizeBytes: params.sizeBytes,
      durationSeconds: null,
    },
  }
}

export async function removeTrack(params: { trackId: string; projectId: string }) {
  const { userId: clerkId } = auth()
  if (!clerkId) throw new Error('Unauthorized')

  const user = await getUserByClerkId(clerkId)
  if (!user) throw new Error('User not found')

  const [row] = await db
    .select({ workspaceId: projects.workspaceId })
    .from(projects)
    .where(eq(projects.id, params.projectId))
    .limit(1)

  if (!row) throw new Error('Project not found')

  const [membership] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(eq(workspaceMembers.workspaceId, row.workspaceId), eq(workspaceMembers.userId, user.id))
    )
    .limit(1)

  if (!membership || (membership.role !== 'owner' && membership.role !== 'editor')) {
    throw new Error('Forbidden')
  }

  await db.transaction(async (tx) => {
    // Remove the audio file first (FK: audio_files → tracks)
    await tx.delete(audioFiles).where(eq(audioFiles.trackId, params.trackId))
    // Null out track references in comments so they become project-level comments
    await tx.update(comments).set({ trackId: null }).where(eq(comments.trackId, params.trackId))
    // Remove version track snapshots for this track
    await tx.delete(projectVersionTracks).where(eq(projectVersionTracks.trackId, params.trackId))
    // Delete the track itself
    await tx.delete(tracks).where(eq(tracks.id, params.trackId))
  })

  revalidatePath(`/projects/${params.projectId}`)
}

export async function updateTrackMix(params: {
  trackId: string
  volume?: number
  isMuted?: boolean
  isSoloed?: boolean
}) {
  const { userId: clerkId } = auth()
  if (!clerkId) throw new Error('Unauthorized')

  if (
    params.volume === undefined &&
    params.isMuted === undefined &&
    params.isSoloed === undefined
  ) {
    throw new Error('No mix changes provided')
  }

  const user = await getUserByClerkId(clerkId)
  if (!user) throw new Error('User not found')

  const [row] = await db
    .select({
      projectId: tracks.projectId,
      workspaceId: projects.workspaceId,
    })
    .from(tracks)
    .innerJoin(projects, eq(projects.id, tracks.projectId))
    .where(eq(tracks.id, params.trackId))
    .limit(1)

  if (!row) throw new Error('Track not found')

  const [membership] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(eq(workspaceMembers.workspaceId, row.workspaceId), eq(workspaceMembers.userId, user.id))
    )
    .limit(1)

  if (!membership || (membership.role !== 'owner' && membership.role !== 'editor')) {
    throw new Error('Forbidden')
  }

  const values: Partial<typeof tracks.$inferInsert> = { updatedAt: new Date() }
  if (params.volume !== undefined) values.volume = Math.max(0, Math.min(1, params.volume))
  if (params.isMuted !== undefined) values.isMuted = params.isMuted
  if (params.isSoloed !== undefined) values.isSoloed = params.isSoloed

  if (params.isSoloed === true) {
    // Solo is mutually exclusive — clear all other tracks in the project first.
    await db.transaction(async (tx) => {
      await tx
        .update(tracks)
        .set({ isSoloed: false, updatedAt: new Date() })
        .where(and(eq(tracks.projectId, row.projectId), ne(tracks.id, params.trackId)))
      await tx.update(tracks).set(values).where(eq(tracks.id, params.trackId))
    })
  } else {
    await db.update(tracks).set(values).where(eq(tracks.id, params.trackId))
  }

  revalidatePath(`/projects/${row.projectId}`)
}
