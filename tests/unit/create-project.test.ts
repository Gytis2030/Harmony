import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/db/queries/users', () => ({
  getUserByClerkId: vi.fn(),
}))

// redirect throws in production; in tests we just capture the call.
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}))

import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getUserByClerkId } from '@/lib/db/queries/users'
import { createProject } from '@/lib/actions/projects'

const MOCK_USER = { id: 'user-uuid', clerkId: 'clerk-abc', email: 'alice@example.com' }
const MOCK_PROJECT_ID = 'proj-new'

function makeFormData(name: string) {
  const fd = new FormData()
  fd.set('name', name)
  return fd
}

function makeSelectChain(result: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  } as never
}

function makeInsertChain(returning: unknown[]) {
  return {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(returning),
  } as never
}

describe('createProject server action', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(auth).mockReturnValue({ userId: 'clerk-abc' } as never)
    vi.mocked(getUserByClerkId).mockResolvedValue(MOCK_USER as never)

    // db.select → workspace membership lookup
    vi.mocked(db.select).mockReturnValue(makeSelectChain([{ workspaceId: 'ws-1' }]))
    // db.insert → project insert
    vi.mocked(db.insert).mockReturnValue(makeInsertChain([{ id: MOCK_PROJECT_ID }]))
  })

  it('calls db.insert and redirects to the new project on success', async () => {
    await createProject(makeFormData('My Beat'))
    expect(vi.mocked(db.insert)).toHaveBeenCalledOnce()
    expect(vi.mocked(redirect)).toHaveBeenCalledWith(`/projects/${MOCK_PROJECT_ID}`)
  })

  it('throws when no workspace is found for the user', async () => {
    vi.mocked(db.select).mockReturnValue(makeSelectChain([]))
    await expect(createProject(makeFormData('My Beat'))).rejects.toThrow(
      'No workspace found for this user.'
    )
  })

  it('throws when user record does not exist', async () => {
    vi.mocked(getUserByClerkId).mockResolvedValue(null as never)
    await expect(createProject(makeFormData('My Beat'))).rejects.toThrow('User record not found.')
  })

  it('throws for a blank project name', async () => {
    await expect(createProject(makeFormData('   '))).rejects.toThrow('Project name is required.')
  })
})
