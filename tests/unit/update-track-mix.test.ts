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

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}))

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { getUserByClerkId } from '@/lib/db/queries/users'
import { updateTrackMix } from '@/lib/actions/tracks'

function makeSelectChain(result: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  } as never
}

const setSpy = vi.fn().mockReturnThis()
const whereSpy = vi.fn().mockResolvedValue(undefined)

function makeUpdateChain() {
  return {
    set: setSpy,
    where: whereSpy,
  } as never
}

describe('updateTrackMix server action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setSpy.mockClear()
    whereSpy.mockClear()

    vi.mocked(auth).mockReturnValue({ userId: 'clerk-abc' } as never)
    vi.mocked(getUserByClerkId).mockResolvedValue({ id: 'user-uuid' } as never)
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([{ projectId: 'project-1', workspaceId: 'ws-1' }]))
      .mockReturnValueOnce(makeSelectChain([{ role: 'owner' }]))
    vi.mocked(db.update).mockReturnValue(makeUpdateChain())
  })

  it('persists volume and muted after verifying workspace membership', async () => {
    await updateTrackMix({ trackId: 'track-1', volume: 0.5, isMuted: true })

    expect(vi.mocked(db.select)).toHaveBeenCalledTimes(2)
    expect(vi.mocked(db.update)).toHaveBeenCalledOnce()
    expect(setSpy).toHaveBeenCalledWith(
      expect.objectContaining({ volume: 0.5, isMuted: true, updatedAt: expect.any(Date) })
    )
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/projects/project-1')
  })

  it('clamps volume before persisting', async () => {
    await updateTrackMix({ trackId: 'track-1', volume: 2 })

    expect(setSpy).toHaveBeenCalledWith(
      expect.objectContaining({ volume: 1, updatedAt: expect.any(Date) })
    )
  })

  it('throws when the user is not a workspace member', async () => {
    vi.mocked(db.select)
      .mockReset()
      .mockReturnValueOnce(makeSelectChain([{ projectId: 'project-1', workspaceId: 'ws-1' }]))
      .mockReturnValueOnce(makeSelectChain([]))

    await expect(updateTrackMix({ trackId: 'track-1', isMuted: true })).rejects.toThrow('Forbidden')
    expect(vi.mocked(db.update)).not.toHaveBeenCalled()
  })
})
