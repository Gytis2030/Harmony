# Architectural Decisions

A running log of meaningful technical choices for Harmony. Write a new entry whenever you make a decision that future-you (or future-Claude) might want to revisit. Keep entries short — context, choice, why, trade-off.

## Format

Each entry uses this template:

```
## YYYY-MM-DD — Short title

**Context.** What problem are we solving? What forced this decision?

**Decision.** What did we pick?

**Alternatives considered.** What else did we look at and why didn't we pick it?

**Trade-offs / consequences.** What do we give up? What's the escape hatch if we change our mind?
```

Decisions go newest-first.

---

## 2026-04-29 — Supabase Postgres instead of Neon

**Context.** The owner already has a Supabase account. Original plan used Neon, but we want to minimize the number of vendor accounts to manage during V1.

**Decision.** Use Supabase's managed Postgres for the database. Do not use Supabase Auth, Storage, or Realtime — those roles stay with Clerk, R2, and Liveblocks respectively. Drizzle ORM still owns the schema layer.

**Alternatives considered.**

- Neon — equally good Postgres host, branching is nicer, but a fresh account/billing surface for no real win here.
- Supabase end-to-end (Auth + Storage + Realtime) — tempting for simplicity, but Supabase Storage egress is expensive for audio streaming, Supabase Auth lacks the org/workspace primitives Clerk gives us out of the box, and Supabase Realtime is not a Yjs provider so we'd still need Liveblocks or self-hosted y-websocket anyway.

**Trade-offs / consequences.** Slightly higher serverless cold-start latency than Neon's auto-scaling, mitigated by using the pooled connection string (`pgbouncer=true`). Migration path back to Neon (or to RDS) is straightforward — Drizzle migrations are vendor-neutral.

---

## 2026-04-29 — Use Liveblocks as the Yjs provider for V1

**Context.** We need real-time CRDT sync for the project state (track positions, volumes, presence). Yjs is the de facto choice for the CRDT itself, but we still need a transport — somewhere websockets terminate and documents persist.

**Decision.** Use Liveblocks as the Yjs provider for V1.

**Alternatives considered.**

- Self-hosted `y-websocket` on Railway or Fly. Cheaper at scale, but it's another service to monitor, secure, and back up. The owner has no ops experience yet.
- Hocuspocus (the Tiptap team's Yjs server). Same operational burden as `y-websocket` plus less familiar.
- Liveblocks. Managed service, generous free tier, presence/cursors come built-in, well-documented Yjs integration.

**Trade-offs / consequences.** We pay per MAU above the free tier and we depend on a vendor for a critical path. Mitigation: keep the Yjs document model vendor-agnostic so we can swap to self-hosted later. The escape hatch is straightforward — Yjs documents are portable, so a migration is "spin up a `y-websocket` server and switch the provider import."

---

## 2026-04-29 — Cloudflare R2 over AWS S3 for audio storage

**Context.** Audio files are large and produce significant egress when collaborators stream them back. We need object storage with predictable cost.

**Decision.** Cloudflare R2.

**Alternatives considered.**

- AWS S3 — industry standard, but egress charges scale with collaboration (every collaborator streaming a stem = bandwidth bill). Bad fit for our usage pattern.
- Backblaze B2 — cheap, but less mature SDK and fewer regions.
- Supabase Storage — convenient if we used Supabase end-to-end, but we're on Neon + Clerk, so it adds another vendor.

**Trade-offs / consequences.** Slightly less mature ecosystem than S3, occasional API quirks. Mitigation: use the S3-compatible API surface so we can swap providers without rewriting upload logic.

---

## 2026-04-29 — Direct browser-to-R2 upload via signed URLs

**Context.** Audio files can be 50–100MB. Proxying through Vercel API routes would be slow, expensive, and hits Vercel's request size limits.

**Decision.** Generate presigned PUT URLs in an API route, upload directly from the browser to R2, then write a `tracks` row referencing the resulting object key.

**Alternatives considered.** Multipart upload through our server (rejected: cost, latency, Vercel limits), tus.io resumable upload protocol (rejected for V1: extra complexity, can add later if reliability needs it).

**Trade-offs / consequences.** We have to validate file type and size client-side and then re-validate server-side after upload (HEAD the object, check Content-Type and Content-Length). Slightly more code than a naïve proxy, but the only realistic option at this file size.

---

## 2026-04-29 — Drizzle ORM over Prisma

**Context.** Need an ORM that plays well with TypeScript, Postgres, serverless cold starts, and Vercel.

**Decision.** Drizzle.

**Alternatives considered.**

- Prisma — more mature, better tooling, but generates a large client and historically has cold-start friction on serverless. Migration story is heavier.
- Kysely — query builder, no ORM features. Would be fine but Drizzle gives us a bit more for similar weight.

**Trade-offs / consequences.** Smaller ecosystem than Prisma, Studio is less polished. Drizzle's schema-as-code is a net positive once you're used to it.

---

## 2026-04-29 — Clerk for auth (V1)

**Context.** Auth is a solved problem we shouldn't build ourselves. We need email + OAuth (Google, at minimum), session management, organization/workspace primitives.

**Decision.** Clerk.

**Alternatives considered.** Supabase Auth (would force Supabase end-to-end), NextAuth/Auth.js (free but more wiring and we own the bugs), Auth0 (priced for enterprise).

**Trade-offs / consequences.** Vendor cost above free tier. Vendor lock-in for user identity is real but tolerable — Clerk exports user data, and we can migrate to Auth.js later if pricing becomes painful.

---

## Template for the next entry

Copy this and fill it in:

```
## YYYY-MM-DD — Short title

**Context.**

**Decision.**

**Alternatives considered.**

**Trade-offs / consequences.**
```
