import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/db/queries/users', () => ({
  getUserByClerkId: vi.fn(),
}))

vi.mock('@/lib/db/queries/activity', () => ({
  recordActivity: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { getUserByClerkId } from '@/lib/db/queries/users'
import {
  createComment,
  createCommentReply,
  deleteComment,
  setCommentPinned,
  setCommentStatus,
} from '@/lib/actions/comments'

const MOCK_USER = {
  id: 'user-uuid',
  displayName: 'Alice',
  email: 'alice@example.com',
}

const MOCK_COMMENT_ROW = {
  id: 'comment-1',
  projectId: 'project-1',
  trackId: null,
  authorUserId: 'user-uuid',
  timestampSeconds: 42,
  timeRangeStartSeconds: null,
  timeRangeEndSeconds: null,
  body: 'Drop should come in earlier.',
  status: 'open' as const,
  isPinned: false,
  createdAt: new Date('2026-05-12T10:00:00.000Z'),
  updatedAt: new Date('2026-05-12T10:00:00.000Z'),
}

const MOCK_REPLY_ROW = {
  id: 'reply-1',
  commentId: 'comment-1',
  authorUserId: 'user-uuid',
  body: 'Agreed, moving it earlier.',
  createdAt: new Date('2026-05-12T10:05:00.000Z'),
  updatedAt: new Date('2026-05-12T10:05:00.000Z'),
}

function makeSelectChain(result: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
    then: vi.fn(),
  } as never
}

function makeInsertChain(returning: unknown[]) {
  return {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(returning),
  } as never
}

const setSpy = vi.fn().mockReturnThis()
const updateWhereSpy = vi.fn().mockReturnThis()

function makeUpdateChain(returning: unknown[]) {
  return {
    set: setSpy,
    where: updateWhereSpy,
    returning: vi.fn().mockResolvedValue(returning),
  } as never
}

const deleteWhereSpy = vi.fn().mockResolvedValue(undefined)

function makeDeleteChain() {
  return {
    where: deleteWhereSpy,
  } as never
}

describe('comment server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setSpy.mockClear()
    updateWhereSpy.mockClear()
    deleteWhereSpy.mockClear()

    vi.mocked(auth).mockReturnValue({ userId: 'clerk-abc' } as never)
    vi.mocked(getUserByClerkId).mockResolvedValue(MOCK_USER as never)
  })

  it('creates a project-level comment with a null trackId', async () => {
    vi.mocked(db.select).mockReturnValue(makeSelectChain([{ workspaceId: 'ws-1' }]))
    vi.mocked(db.insert).mockReturnValue(makeInsertChain([MOCK_COMMENT_ROW]))

    const comment = await createComment({
      projectId: 'project-1',
      trackId: null,
      timestampSeconds: 42,
      body: '  Drop should come in earlier.  ',
    })

    expect(vi.mocked(db.insert)).toHaveBeenCalledOnce()
    expect(comment.trackId).toBeNull()
    expect(comment.body).toBe('Drop should come in earlier.')
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/projects/project-1')
  })

  it('rejects a track comment when the track belongs to another project', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([{ workspaceId: 'ws-1' }]))
      .mockReturnValueOnce(makeSelectChain([{ projectId: 'other-project', name: 'Vocal' }]))

    await expect(
      createComment({
        projectId: 'project-1',
        trackId: 'track-1',
        timestampSeconds: 12,
        body: 'Vocal is too loud here.',
      })
    ).rejects.toThrow('Track not found in this project.')

    expect(vi.mocked(db.insert)).not.toHaveBeenCalled()
  })

  it('updates comment status after verifying workspace membership', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([{ projectId: 'project-1', workspaceId: 'ws-1' }]))
      .mockReturnValueOnce(makeSelectChain([{ role: 'owner' }]))
      .mockReturnValueOnce(makeSelectChain([{ displayName: 'Alice', email: 'alice@example.com' }]))

    vi.mocked(db.update).mockReturnValue(
      makeUpdateChain([{ ...MOCK_COMMENT_ROW, status: 'resolved' as const }])
    )

    const comment = await setCommentStatus({ commentId: 'comment-1', status: 'resolved' })

    expect(comment.status).toBe('resolved')
    expect(setSpy).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'resolved', updatedAt: expect.any(Date) })
    )
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/projects/project-1')
  })

  it('pins a comment after verifying workspace membership', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([{ projectId: 'project-1', workspaceId: 'ws-1' }]))
      .mockReturnValueOnce(makeSelectChain([{ role: 'owner' }]))
      .mockReturnValueOnce(makeSelectChain([{ displayName: 'Alice', email: 'alice@example.com' }]))

    vi.mocked(db.update).mockReturnValue(makeUpdateChain([{ ...MOCK_COMMENT_ROW, isPinned: true }]))

    const comment = await setCommentPinned({ commentId: 'comment-1', isPinned: true })

    expect(comment.isPinned).toBe(true)
    expect(setSpy).toHaveBeenCalledWith(
      expect.objectContaining({ isPinned: true, updatedAt: expect.any(Date) })
    )
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/projects/project-1')
  })

  it('deletes a comment after verifying workspace membership', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([{ projectId: 'project-1', workspaceId: 'ws-1' }]))
      .mockReturnValueOnce(makeSelectChain([{ role: 'owner' }]))

    vi.mocked(db.delete).mockReturnValue(makeDeleteChain())

    const deleted = await deleteComment('comment-1')

    expect(deleted).toEqual({ id: 'comment-1' })
    expect(vi.mocked(db.delete)).toHaveBeenCalledOnce()
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/projects/project-1')
  })

  it('creates a reply after verifying workspace membership', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([{ projectId: 'project-1', workspaceId: 'ws-1' }]))
      .mockReturnValueOnce(makeSelectChain([{ role: 'owner' }]))

    vi.mocked(db.insert).mockReturnValue(makeInsertChain([MOCK_REPLY_ROW]))

    const reply = await createCommentReply({
      commentId: 'comment-1',
      body: '  Agreed, moving it earlier.  ',
    })

    expect(reply).toEqual(
      expect.objectContaining({
        id: 'reply-1',
        commentId: 'comment-1',
        body: 'Agreed, moving it earlier.',
        authorName: 'Alice',
      })
    )
    expect(vi.mocked(db.insert)).toHaveBeenCalledOnce()
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/projects/project-1')
  })
})
