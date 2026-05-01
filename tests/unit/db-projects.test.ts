import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockChain = vi.hoisted(() => ({
  from: vi.fn().mockReturnThis(),
  innerJoin: vi.fn().mockReturnThis(),
  where: vi.fn().mockResolvedValue([
    {
      id: 'proj-1',
      name: 'Test Project',
      workspaceId: 'ws-1',
      bpm: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    },
  ]),
}))

vi.mock('@/lib/db', () => ({
  db: { select: vi.fn().mockReturnValue(mockChain) },
}))

import { getProjectsForUser } from '@/lib/db/queries/projects'
import { db } from '@/lib/db'

describe('getProjectsForUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Re-apply mockReturnValue after clearAllMocks clears call history
    vi.mocked(db.select).mockReturnValue(mockChain as never)
  })

  it('returns an array of projects for a given user', async () => {
    const result = await getProjectsForUser('user-uuid')
    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ id: 'proj-1', name: 'Test Project', workspaceId: 'ws-1' })
  })

  it('calls select with two innerJoin calls and one where call', async () => {
    await getProjectsForUser('user-uuid')
    expect(vi.mocked(db.select)).toHaveBeenCalledOnce()
    expect(mockChain.innerJoin).toHaveBeenCalledTimes(2)
    expect(mockChain.where).toHaveBeenCalledOnce()
  })
})
