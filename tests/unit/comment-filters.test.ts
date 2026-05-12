import { describe, it, expect } from 'vitest'
import { filterComments, sortComments, countByFilter } from '@/lib/comments/filter'
import type { CommentDto } from '@/lib/actions/comments'

function makeComment(overrides: Partial<CommentDto> = {}): CommentDto {
  return {
    id: 'c1',
    projectId: 'p1',
    trackId: null,
    trackName: null,
    authorUserId: 'u1',
    authorName: 'Alice',
    timestampSeconds: 10,
    timeRangeStartSeconds: null,
    timeRangeEndSeconds: null,
    body: 'Test',
    status: 'open',
    isPinned: false,
    createdAt: new Date('2026-05-12T10:00:00Z').toISOString(),
    updatedAt: new Date('2026-05-12T10:00:00Z').toISOString(),
    replies: [],
    ...overrides,
  }
}

const open1 = makeComment({ id: 'c1', status: 'open', timestampSeconds: 30 })
const open2 = makeComment({ id: 'c2', status: 'open', timestampSeconds: 10, isPinned: true })
const resolved1 = makeComment({ id: 'c3', status: 'resolved', timestampSeconds: 20 })
const all = [open1, open2, resolved1]

describe('filterComments', () => {
  it('returns only open comments for "open" filter', () => {
    expect(filterComments(all, 'open')).toHaveLength(2)
    expect(filterComments(all, 'open').every((c) => c.status === 'open')).toBe(true)
  })

  it('returns only resolved comments for "resolved" filter', () => {
    expect(filterComments(all, 'resolved')).toHaveLength(1)
    expect(filterComments(all, 'resolved')[0].id).toBe('c3')
  })

  it('returns all comments for "all" filter', () => {
    expect(filterComments(all, 'all')).toHaveLength(3)
  })

  it('returns empty array when no comments match', () => {
    expect(filterComments([open1, open2], 'resolved')).toHaveLength(0)
  })
})

describe('sortComments', () => {
  it('places pinned comments before unpinned ones', () => {
    const sorted = sortComments([open1, open2])
    expect(sorted[0].isPinned).toBe(true)
    expect(sorted[1].isPinned).toBe(false)
  })

  it('sorts by timestampSeconds within same pin status', () => {
    const a = makeComment({ id: 'a', timestampSeconds: 60 })
    const b = makeComment({ id: 'b', timestampSeconds: 20 })
    const c = makeComment({ id: 'c', timestampSeconds: 40 })
    const sorted = sortComments([a, b, c])
    expect(sorted.map((x) => x.id)).toEqual(['b', 'c', 'a'])
  })

  it('does not mutate the original array', () => {
    const original = [open1, open2]
    sortComments(original)
    expect(original[0].id).toBe('c1')
  })
})

describe('countByFilter', () => {
  it('counts correctly for all filters', () => {
    const counts = countByFilter(all)
    expect(counts.open).toBe(2)
    expect(counts.resolved).toBe(1)
    expect(counts.all).toBe(3)
  })

  it('returns zeros for empty array', () => {
    const counts = countByFilter([])
    expect(counts.open).toBe(0)
    expect(counts.resolved).toBe(0)
    expect(counts.all).toBe(0)
  })
})
