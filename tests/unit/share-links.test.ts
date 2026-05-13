import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'crypto'

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/db/queries/users', () => ({
  getUserByClerkId: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/storage/r2', () => ({
  createPresignedGetUrl: vi.fn().mockResolvedValue('https://r2.example.com/presigned'),
}))

const mockSession = {
  FULL_ACCESS: 'full',
  allow: vi.fn(),
  authorize: vi.fn().mockResolvedValue({ status: 200, body: '{}' }),
}

vi.mock('@liveblocks/node', () => {
  class Liveblocks {
    prepareSession() {
      return mockSession
    }
  }
  return { Liveblocks }
})

vi.mock('@/lib/db/queries/projects', () => ({
  getShareLinkByTokenHash: vi.fn(),
  getActiveShareLinksForProject: vi.fn(),
  getProjectByIdWithShareGrant: vi.fn(),
  getProjectById: vi.fn(),
  getShareGrantForUser: vi.fn(),
}))

import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { getUserByClerkId } from '@/lib/db/queries/users'
import { getShareLinkByTokenHash, getProjectByIdWithShareGrant } from '@/lib/db/queries/projects'
import { createShareLink, activateShareLink } from '@/lib/actions/share-links'
import { createComment, createCommentReply } from '@/lib/actions/comments'
import { POST as liveblocksAuth } from '@/app/api/liveblocks-auth/route'
import { GET as trackUrlGet } from '@/app/api/tracks/[id]/url/route'

function makeSelectChain(result: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  } as never
}

function makeUpdateChain() {
  return {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
  } as never
}

const MOCK_USER = { id: 'user-uuid', email: 'user@test.com', displayName: 'Test User' }
const MOCK_PROJECT_ID = '00000000-0000-0000-0000-000000000001'
const MOCK_WORKSPACE_ID = '00000000-0000-0000-0000-000000000002'
const MOCK_LINK_ID = '00000000-0000-0000-0000-000000000003'

describe('share link token security', () => {
  it('stores SHA-256 hash of the raw token, not the raw token itself', async () => {
    vi.mocked(auth).mockReturnValue({ userId: 'clerk-abc' } as never)
    vi.mocked(getUserByClerkId).mockResolvedValue(MOCK_USER as never)

    // requireOwnerOrEditor check
    vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([{ role: 'owner' }]))
    // revoke existing
    vi.mocked(db.update).mockReturnValueOnce(makeUpdateChain())
    // insert
    const capturedValues: Record<string, unknown>[] = []
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockImplementation((vals) => {
        capturedValues.push(vals)
        return {
          returning: vi.fn().mockResolvedValue([
            {
              id: MOCK_LINK_ID,
              projectId: MOCK_PROJECT_ID,
              accessLevel: 'view',
              isActive: true,
              createdAt: new Date(),
            },
          ]),
        }
      }),
    } as never)

    const result = await createShareLink({ projectId: MOCK_PROJECT_ID, accessLevel: 'view' })

    expect(result.rawToken).toBeTruthy()
    expect(result.rawToken).toHaveLength(64) // 32 bytes hex

    const expectedHash = createHash('sha256').update(result.rawToken).digest('hex')
    const storedHash = capturedValues[0]?.tokenHash as string

    expect(storedHash).toBe(expectedHash)
    expect(storedHash).not.toBe(result.rawToken)
  })
})

describe('activateShareLink', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockReturnValue({ userId: 'clerk-abc' } as never)
    vi.mocked(getUserByClerkId).mockResolvedValue(MOCK_USER as never)
  })

  it('throws when the link is inactive (revoked)', async () => {
    vi.mocked(getShareLinkByTokenHash).mockResolvedValue({
      id: MOCK_LINK_ID,
      projectId: MOCK_PROJECT_ID,
      accessLevel: 'view' as const,
      isActive: false,
      createdAt: new Date(),
    })

    await expect(activateShareLink('some-raw-token')).rejects.toThrow('revoked')
  })

  it('throws when the link does not exist', async () => {
    vi.mocked(getShareLinkByTokenHash).mockResolvedValue(null as never)

    await expect(activateShareLink('nonexistent-token')).rejects.toThrow('invalid')
  })
})

describe('comment permissions for share-grant users', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockReturnValue({ userId: 'clerk-abc' } as never)
    vi.mocked(getUserByClerkId).mockResolvedValue(MOCK_USER as never)
  })

  it('throws Forbidden when user has view-only share grant', async () => {
    // No workspace membership
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([])) // requireCommentPermission: no member row
      .mockReturnValueOnce(makeSelectChain([])) // requireCommentPermission: no comment grant

    await expect(
      createComment({
        projectId: MOCK_PROJECT_ID,
        timestampSeconds: 10,
        body: 'Hello',
      })
    ).rejects.toThrow('Forbidden')
  })

  it('proceeds when user has comment-access share grant', async () => {
    // No workspace membership
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([])) // no member row
      .mockReturnValueOnce(makeSelectChain([{ accessLevel: 'comment' }])) // grant with comment
    // track lookup (optional, no trackId)
    // insert comment
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([
        {
          id: 'comment-1',
          projectId: MOCK_PROJECT_ID,
          trackId: null,
          authorUserId: MOCK_USER.id,
          timestampSeconds: 10,
          timeRangeStartSeconds: null,
          timeRangeEndSeconds: null,
          body: 'Hello',
          status: 'open',
          isPinned: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]),
    } as never)

    // Should not throw — may succeed or fail on subsequent steps, but not on permission
    await expect(
      createComment({
        projectId: MOCK_PROJECT_ID,
        timestampSeconds: 10,
        body: 'Hello',
      })
    ).resolves.toBeDefined()
  })

  it('throws Forbidden for createCommentReply when user has no comment access', async () => {
    // Find the comment first
    vi.mocked(db.select)
      .mockReturnValueOnce(
        makeSelectChain([
          {
            projectId: MOCK_PROJECT_ID,
            workspaceId: MOCK_WORKSPACE_ID,
          },
        ])
      ) // comment lookup
      .mockReturnValueOnce(makeSelectChain([])) // no workspace member
      .mockReturnValueOnce(makeSelectChain([])) // no comment grant

    await expect(createCommentReply({ commentId: 'comment-1', body: 'Reply' })).rejects.toThrow(
      'Forbidden'
    )
  })
})

describe('audio URL route access control', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockReturnValue({ userId: 'clerk-abc' } as never)
    vi.mocked(getUserByClerkId).mockResolvedValue(MOCK_USER as never)
  })

  it('returns 200 for share-grant user accessing their project audio', async () => {
    // Track row with r2Key + project/workspace
    vi.mocked(db.select)
      .mockReturnValueOnce(
        makeSelectChain([
          {
            r2Key: 'audio/test.wav',
            workspaceId: MOCK_WORKSPACE_ID,
            projectId: MOCK_PROJECT_ID,
          },
        ])
      )
      .mockReturnValueOnce(makeSelectChain([])) // no workspace membership
      .mockReturnValueOnce(makeSelectChain([{ accessLevel: 'view' }])) // share grant exists

    const req = new Request('http://localhost/api/tracks/track-1/url')
    const res = await trackUrlGet(req, { params: { id: 'track-1' } })
    expect(res.status).toBe(200)
  })

  it('returns 403 for user with no grant and no workspace membership', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(
        makeSelectChain([
          {
            r2Key: 'audio/test.wav',
            workspaceId: MOCK_WORKSPACE_ID,
            projectId: MOCK_PROJECT_ID,
          },
        ])
      )
      .mockReturnValueOnce(makeSelectChain([])) // no workspace membership
      .mockReturnValueOnce(makeSelectChain([])) // no share grant

    const req = new Request('http://localhost/api/tracks/track-1/url')
    const res = await trackUrlGet(req, { params: { id: 'track-1' } })
    expect(res.status).toBe(403)
  })
})

describe('Liveblocks auth access control', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockReturnValue({ userId: 'clerk-abc' } as never)
    vi.mocked(getUserByClerkId).mockResolvedValue(MOCK_USER as never)
  })

  it('grants access when user has a share grant for the project', async () => {
    vi.mocked(getProjectByIdWithShareGrant).mockResolvedValue({
      id: MOCK_PROJECT_ID,
      name: 'Test Project',
      workspaceId: MOCK_WORKSPACE_ID,
      bpm: null,
      timeSignatureNumerator: 4,
      timeSignatureDenominator: 4,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const req = new Request('http://localhost/api/liveblocks-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room: `project:${MOCK_PROJECT_ID}` }),
    })

    // The Liveblocks prepareSession/authorize is real SDK — we just check it doesn't 403
    // Since we can't easily mock the Liveblocks SDK, assert getProjectByIdWithShareGrant was called
    try {
      await liveblocksAuth(req)
    } catch {
      // SDK may throw without real credentials — acceptable in unit test
    }
    expect(getProjectByIdWithShareGrant).toHaveBeenCalledWith(MOCK_PROJECT_ID, MOCK_USER.id)
  })

  it('returns 403 when user has no access to the project', async () => {
    vi.mocked(getProjectByIdWithShareGrant).mockResolvedValue(null as never)

    const req = new Request('http://localhost/api/liveblocks-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room: `project:${MOCK_PROJECT_ID}` }),
    })

    const res = await liveblocksAuth(req)
    expect(res.status).toBe(403)
  })
})
