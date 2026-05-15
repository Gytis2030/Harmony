import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoisted chains — data must be inlined because vi.hoisted() runs before variable declarations.
const projectsChain = vi.hoisted(() => ({
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

const stemChain = vi.hoisted(() => ({
  from: vi.fn().mockReturnThis(),
  innerJoin: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  groupBy: vi.fn().mockResolvedValue([{ projectId: 'proj-1', stemCount: 3 }]),
}))

// Track which call we're on so we can return different chains.
let selectCallCount = 0

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => {
      selectCallCount++
      return selectCallCount === 1 ? projectsChain : stemChain
    }),
  },
}))

import { getProjectsForUser } from '@/lib/db/queries/projects'
import { db } from '@/lib/db'

describe('getProjectsForUser', () => {
  beforeEach(() => {
    selectCallCount = 0
    vi.clearAllMocks()
    vi.mocked(db.select).mockImplementation(() => {
      selectCallCount++
      return (selectCallCount === 1 ? projectsChain : stemChain) as never
    })
  })

  it('returns projects with stemCount', async () => {
    const result = await getProjectsForUser('user-uuid')
    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ id: 'proj-1', name: 'Test Project', stemCount: 3 })
  })

  it('makes two db.select calls — projects then stem counts', async () => {
    await getProjectsForUser('user-uuid')
    expect(vi.mocked(db.select)).toHaveBeenCalledTimes(2)
    expect(projectsChain.innerJoin).toHaveBeenCalledTimes(2)
    expect(projectsChain.where).toHaveBeenCalledOnce()
    expect(stemChain.innerJoin).toHaveBeenCalledOnce()
    expect(stemChain.groupBy).toHaveBeenCalledOnce()
  })
})
