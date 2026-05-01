import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { Webhook } from 'svix'
import { db } from '@/lib/db'
import { users, workspaces, workspaceMembers } from '@/lib/db/schema'

type ClerkUserData = {
  id: string
  email_addresses: Array<{ id: string; email_address: string }>
  primary_email_address_id: string
  first_name: string | null
  last_name: string | null
  image_url: string | null
}

// We subscribe to user.created and user.updated only, so all incoming payloads share this shape.
type ClerkWebhookEvent = { type: string; data: ClerkUserData }

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'workspace'
  )
}

// Checks if the base slug is taken; appends a 6-char random suffix if so.
async function findUniqueSlug(base: string): Promise<string> {
  const truncated = base.slice(0, 34)
  const existing = await db
    .select({ slug: workspaces.slug })
    .from(workspaces)
    .where(eq(workspaces.slug, truncated))
    .limit(1)
  if (existing.length === 0) return truncated
  const suffix = Math.random().toString(36).slice(2, 8)
  return `${truncated.slice(0, 33)}-${suffix}`.slice(0, 40)
}

export async function POST(req: Request) {
  const body = await req.text()
  const headersList = headers()

  const svixId = headersList.get('svix-id')
  const svixTimestamp = headersList.get('svix-timestamp')
  const svixSignature = headersList.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response('Missing svix headers', { status: 400 })
  }

  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET
  if (!webhookSecret) {
    throw new Error('CLERK_WEBHOOK_SECRET is not set')
  }

  let evt: ClerkWebhookEvent
  try {
    const wh = new Webhook(webhookSecret)
    evt = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkWebhookEvent
  } catch {
    return new Response('Invalid webhook signature', { status: 400 })
  }

  if (evt.type === 'user.created') {
    const d = evt.data
    const primaryEmail =
      d.email_addresses.find((e) => e.id === d.primary_email_address_id)?.email_address ??
      d.email_addresses[0]?.email_address ??
      ''
    const displayName = [d.first_name, d.last_name].filter(Boolean).join(' ') || null
    const emailLocalPart = primaryEmail.split('@')[0] ?? 'user'
    const slug = await findUniqueSlug(slugify(displayName ?? emailLocalPart))

    await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(users)
        .values({ clerkId: d.id, email: primaryEmail, displayName, avatarUrl: d.image_url })
        .onConflictDoNothing()
        .returning()

      // Clerk replays on failure — if the user already exists, bail out safely.
      if (inserted.length === 0) return

      const [workspace] = await tx
        .insert(workspaces)
        .values({ name: 'My Projects', slug, ownerId: inserted[0].id })
        .returning()

      await tx.insert(workspaceMembers).values({
        workspaceId: workspace.id,
        userId: inserted[0].id,
        role: 'owner',
      })
    })
  }

  if (evt.type === 'user.updated') {
    const d = evt.data
    const primaryEmail = d.email_addresses.find(
      (e) => e.id === d.primary_email_address_id
    )?.email_address
    const displayName = [d.first_name, d.last_name].filter(Boolean).join(' ') || null

    await db
      .update(users)
      .set({
        ...(primaryEmail && { email: primaryEmail }),
        displayName,
        avatarUrl: d.image_url,
        updatedAt: new Date(),
      })
      .where(eq(users.clerkId, d.id))
  }

  return Response.json({ received: true })
}
