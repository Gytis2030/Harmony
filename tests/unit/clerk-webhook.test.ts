import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoist verify spy so the MockWebhook class factory can close over it
const { svixVerify } = vi.hoisted(() => ({ svixVerify: vi.fn() }))

// Replace svix with a real class so `new Webhook(secret).verify` is svixVerify
vi.mock('svix', () => ({
  Webhook: class MockWebhook {
    verify = svixVerify
    constructor() {}
  },
}))

vi.mock('@/lib/db', () => ({
  db: {
    transaction: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('next/headers', () => ({ headers: vi.fn() }))

import { db } from '@/lib/db'
import { headers } from 'next/headers'
import { POST } from '@/app/api/webhooks/clerk/route'

const USER_CREATED_PAYLOAD = {
  type: 'user.created',
  data: {
    id: 'user_abc123',
    email_addresses: [{ id: 'em_1', email_address: 'alice@example.com' }],
    primary_email_address_id: 'em_1',
    first_name: 'Alice',
    last_name: 'Smith',
    image_url: 'https://example.com/avatar.jpg',
  },
}

const USER_UPDATED_PAYLOAD = { ...USER_CREATED_PAYLOAD, type: 'user.updated' }

const SVIX_HEADER_MAP: Record<string, string> = {
  'svix-id': 'test-id',
  'svix-timestamp': '1234567890',
  'svix-signature': 'test-sig',
}

function makeSvixHeaders() {
  return { get: (key: string) => SVIX_HEADER_MAP[key] ?? null } as never
}

function makeRequest(body: string) {
  return new Request('http://localhost/api/webhooks/clerk', { method: 'POST', body })
}

describe('POST /api/webhooks/clerk', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CLERK_WEBHOOK_SECRET = 'whsec_test'

    svixVerify.mockReturnValue(USER_CREATED_PAYLOAD)

    vi.mocked(headers).mockReturnValue(makeSvixHeaders())

    // findUniqueSlug calls db.select — [] means base slug is available
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    } as never)

    // Default: user insert succeeds; workspace and member inserts follow
    vi.mocked(db.transaction).mockImplementation(async (cb) => {
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnThis(),
        onConflictDoNothing: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: 'user-uuid' }]),
      })
      await cb({ insert: mockInsert } as never)
    })

    vi.mocked(db.update).mockReturnValue({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    } as never)
  })

  it('returns 400 when svix headers are missing', async () => {
    vi.mocked(headers).mockReturnValue({ get: vi.fn().mockReturnValue(null) } as never)
    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(400)
  })

  it('returns 400 when signature verification throws', async () => {
    svixVerify.mockImplementation(() => {
      throw new Error('Bad signature')
    })
    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(400)
  })

  it('calls db.transaction on user.created and returns 200', async () => {
    const res = await POST(makeRequest(JSON.stringify(USER_CREATED_PAYLOAD)))
    expect(vi.mocked(db.transaction)).toHaveBeenCalledOnce()
    expect(res.status).toBe(200)
  })

  it('skips workspace creation if user already exists (idempotency)', async () => {
    let insertCallCount = 0
    vi.mocked(db.transaction).mockImplementationOnce(async (cb) => {
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnThis(),
        onConflictDoNothing: vi.fn().mockReturnThis(),
        returning: vi.fn().mockImplementation(() => {
          insertCallCount++
          return Promise.resolve([]) // conflict — user already exists
        }),
      })
      await cb({ insert: mockInsert } as never)
    })
    const res = await POST(makeRequest(JSON.stringify(USER_CREATED_PAYLOAD)))
    expect(res.status).toBe(200)
    expect(insertCallCount).toBe(1) // only the user insert ran; workspace skipped
  })

  it('calls db.update on user.updated and returns 200', async () => {
    svixVerify.mockReturnValue(USER_UPDATED_PAYLOAD)
    const res = await POST(makeRequest(JSON.stringify(USER_UPDATED_PAYLOAD)))
    expect(vi.mocked(db.update)).toHaveBeenCalledOnce()
    expect(res.status).toBe(200)
  })
})
