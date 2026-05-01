import { asc, eq } from 'drizzle-orm'
import { db } from '../index'
import { audioFiles, tracks } from '../schema'

export async function getTracksForProject(projectId: string) {
  return db
    .select({
      id: tracks.id,
      name: tracks.name,
      position: tracks.position,
      volume: tracks.volume,
      isMuted: tracks.isMuted,
      isSoloed: tracks.isSoloed,
      color: tracks.color,
      audioFile: {
        id: audioFiles.id,
        r2Key: audioFiles.r2Key,
        originalFilename: audioFiles.originalFilename,
        mimeType: audioFiles.mimeType,
        sizeBytes: audioFiles.sizeBytes,
        durationSeconds: audioFiles.durationSeconds,
      },
    })
    .from(tracks)
    .leftJoin(audioFiles, eq(audioFiles.trackId, tracks.id))
    .where(eq(tracks.projectId, projectId))
    .orderBy(asc(tracks.position))
}
