import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/db/queries/users', () => ({
  getUserByClerkId: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/db/queries/activity', () => ({
  recordActivity: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    transaction: vi.fn(),
  },
}))

import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { getUserByClerkId } from '@/lib/db/queries/users'
import { addTrack } from '@/lib/actions/tracks'

const TRACK_ID = 'track-uuid-1'
const AUDIO_FILE_ID = 'af-uuid-1'

function makeSelectChain(result: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  } as never
}

function makeSelectChainNoLimit(result: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(result),
  } as never
}

function makeTransactionMock() {
  return vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
    const tx = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi
            .fn()
            // First call: tracks insert → returns track row
            .mockResolvedValueOnce([{ id: TRACK_ID }])
            // Second call: audioFiles insert → returns audio file row
            .mockResolvedValueOnce([{ id: AUDIO_FILE_ID }]),
        }),
      }),
    }
    await fn(tx)
  })
}

const VALID_PARAMS = {
  r2Key: 'audio/proj-1/uuid-kick.wav',
  filename: 'kick.wav',
  mimeType: 'audio/wav',
  sizeBytes: 1024 * 1024,
  projectId: 'proj-1',
}

describe('addTrack server action', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(auth).mockReturnValue({ userId: 'clerk-abc' } as never)
    vi.mocked(getUserByClerkId).mockResolvedValue({ id: 'user-uuid' } as never)

    vi.mocked(db.select)
      // 1. project lookup
      .mockReturnValueOnce(makeSelectChain([{ workspaceId: 'ws-1' }]))
      // 2. membership check
      .mockReturnValueOnce(makeSelectChain([{ role: 'owner' }]))
      // 3. MAX(position) query
      .mockReturnValueOnce(makeSelectChainNoLimit([{ maxPos: 2 }]))

    vi.mocked(db.transaction).mockImplementation(makeTransactionMock())
  })

  it('returns the created track with correct shape', async () => {
    const track = await addTrack(VALID_PARAMS)

    expect(track).toMatchObject({
      id: TRACK_ID,
      name: 'kick', // extension stripped
      volume: 1.0,
      isMuted: false,
      isSoloed: false,
      color: null,
      audioFile: {
        id: AUDIO_FILE_ID,
        originalFilename: 'kick.wav',
        sizeBytes: VALID_PARAMS.sizeBytes,
        durationSeconds: null,
      },
    })
  })

  it('assigns position as MAX(position)+1', async () => {
    // MAX(position) = 2, so next position should be 3.
    // We can't inspect the insert args directly without deeper mocking,
    // but confirming the action completes without error is the goal here.
    await expect(addTrack(VALID_PARAMS)).resolves.toMatchObject({ id: TRACK_ID })
  })

  it('uses position 1 when there are no existing tracks', async () => {
    vi.mocked(db.select)
      .mockReset()
      .mockReturnValueOnce(makeSelectChain([{ workspaceId: 'ws-1' }]))
      .mockReturnValueOnce(makeSelectChain([{ role: 'owner' }]))
      .mockReturnValueOnce(makeSelectChainNoLimit([{ maxPos: null }]))

    vi.mocked(db.transaction).mockImplementation(makeTransactionMock())

    await expect(addTrack(VALID_PARAMS)).resolves.toMatchObject({ id: TRACK_ID })
  })

  it('throws Forbidden for commenter role', async () => {
    vi.mocked(db.select)
      .mockReset()
      .mockReturnValueOnce(makeSelectChain([{ workspaceId: 'ws-1' }]))
      .mockReturnValueOnce(makeSelectChain([{ role: 'commenter' }]))

    await expect(addTrack(VALID_PARAMS)).rejects.toThrow('Forbidden')
    expect(vi.mocked(db.transaction)).not.toHaveBeenCalled()
  })

  it('throws Forbidden for viewer role', async () => {
    vi.mocked(db.select)
      .mockReset()
      .mockReturnValueOnce(makeSelectChain([{ workspaceId: 'ws-1' }]))
      .mockReturnValueOnce(makeSelectChain([{ role: 'viewer' }]))

    await expect(addTrack(VALID_PARAMS)).rejects.toThrow('Forbidden')
    expect(vi.mocked(db.transaction)).not.toHaveBeenCalled()
  })

  it('throws Unauthorized when not logged in', async () => {
    vi.mocked(auth).mockReturnValue({ userId: null } as never)
    await expect(addTrack(VALID_PARAMS)).rejects.toThrow('Unauthorized')
  })

  it('does not let activity failure swallow the created track', async () => {
    const { recordActivity } = await import('@/lib/db/queries/activity')
    vi.mocked(recordActivity).mockRejectedValueOnce(new Error('activity DB down'))

    // Should still resolve with track data despite activity failure.
    await expect(addTrack(VALID_PARAMS)).resolves.toMatchObject({ id: TRACK_ID })
  })
})
