import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/db/queries/users', () => ({
  getUserByClerkId: vi.fn(),
}))

vi.mock('@/lib/storage/r2', () => ({
  createPresignedPutUrl: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: { select: vi.fn() },
}))

import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { getUserByClerkId } from '@/lib/db/queries/users'
import { createPresignedPutUrl } from '@/lib/storage/r2'
import { POST } from '@/app/api/uploads/sign/route'

function makeSelectChain(result: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  } as never
}

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/uploads/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const VALID_BODY = {
  filename: 'kick.wav',
  contentType: 'audio/wav',
  sizeBytes: 1024 * 1024,
  projectId: 'proj-1',
}

describe('POST /api/uploads/sign', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(auth).mockReturnValue({ userId: 'clerk-abc' } as never)
    vi.mocked(getUserByClerkId).mockResolvedValue({ id: 'user-uuid' } as never)
    vi.mocked(createPresignedPutUrl).mockResolvedValue('https://r2.example.com/presigned')

    // First db.select → project lookup; second → membership check
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([{ workspaceId: 'ws-1' }]))
      .mockReturnValueOnce(makeSelectChain([{ role: 'owner' }]))
  })

  it('returns 401 when user is not authenticated', async () => {
    vi.mocked(auth).mockReturnValue({ userId: null } as never)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(401)
  })

  it('returns 400 for missing fields', async () => {
    const res = await POST(makeRequest({ filename: 'kick.wav' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for unsupported mime type', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, contentType: 'video/mp4' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for file over 100 MB', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, sizeBytes: 101 * 1024 * 1024 }))
    expect(res.status).toBe(400)
  })

  it('returns 200 with url and r2Key for a valid audio/wav request', async () => {
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toMatchObject({ url: expect.any(String), r2Key: expect.any(String) })
    expect(json.r2Key).toContain('proj-1')
    expect(json.r2Key).toContain('kick.wav')
  })

  it.each([
    'audio/wav',
    'audio/wave',
    'audio/x-wav',
    'audio/mpeg',
    'audio/mp3',
    'audio/mpeg3',
    'audio/x-mpeg-3',
  ])('returns 200 for allowed content type: %s', async (contentType) => {
    // Refresh the db mocks for each iteration.
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([{ workspaceId: 'ws-1' }]))
      .mockReturnValueOnce(makeSelectChain([{ role: 'owner' }]))

    const res = await POST(makeRequest({ ...VALID_BODY, contentType }))
    expect(res.status).toBe(200)
  })

  it('returns 403 when user is not a workspace member', async () => {
    // mockReset clears the beforeEach queue before adding test-specific responses.
    vi.mocked(db.select)
      .mockReset()
      .mockReturnValueOnce(makeSelectChain([{ workspaceId: 'ws-1' }]))
      .mockReturnValueOnce(makeSelectChain([]))
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(403)
  })

  it('returns 403 when project is not found', async () => {
    vi.mocked(db.select).mockReset().mockReturnValueOnce(makeSelectChain([]))
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(403)
  })
})
