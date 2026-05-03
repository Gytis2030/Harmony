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

## 2026-05-02 — Safari ignores AudioContext sampleRate option; resample is the common case

**Context.** Safari does not honour `{ sampleRate: 48000 }` in the `AudioContext`
constructor and instead uses the system's hardware rate (typically 44100Hz or 48000Hz
depending on the device). The `AudioEngine.loadTrack` method normalises every decoded
buffer to 48000Hz via `OfflineAudioContext` before caching, so playback is consistent
regardless of what rate Safari chose.

**Decision.** Accept this behaviour. Do not attempt to detect or work around it. The
resample path already handles it uniformly.

**Alternatives considered.** Detecting `ctx.sampleRate !== 48000` post-construction and
warning the user. Rejected — it adds UI complexity for a situation that is silently
handled correctly by the resample path.

**Trade-offs / consequences.** In Safari, every first load resamples through
`OfflineAudioContext`. At typical stem lengths (30s–5min) this is fast enough to be
imperceptible. If profiling shows otherwise, caching resampled buffers to IndexedDB is
the escape hatch for V2.

---

## 2026-05-01 — Orphaned R2 objects tolerated in V1; cleanup deferred

**Context.** If the browser PUT to R2 succeeds but the subsequent `addTrack` Server Action fails (network drop, DB error, etc.), R2 holds an object with no corresponding `audio_files` row.

**Decision.** Tolerate orphans for V1. The `UploadWidget` catches the Server Action error and shows an error banner with a retry button. We do not attempt server-side cleanup.

**Alternatives considered.** Two-phase approach: write a pending row before signing, then mark it complete after the action runs. Rejected for V1 — adds complexity and a cleanup cron before we know how often this actually occurs.

**Trade-offs / consequences.** Orphaned objects accumulate over time. Mitigation for V2: a periodic job that lists R2 keys, diffs against `audio_files`, and deletes orphans older than 24 hours.

---

## 2026-05-01 — XHR for audio upload progress; `projectId` required by sign route

**Context.** Phase 3 adds direct-to-R2 uploads. Two small decisions needed documenting.

**Decision.** (1) Use `XMLHttpRequest` for the browser PUT rather than `fetch` — `fetch` has no upload progress API in current browsers. (2) The `POST /api/uploads/sign` route accepts `projectId` in the body (beyond the spec's filename + type + size) to namespace R2 keys by project and to gate the request against workspace membership.

**Alternatives considered.** (1) `fetch` + `ReadableStream` — theoretically possible but lacks cross-browser upload progress support. (2) Omitting `projectId` from the sign route — would require a separate membership check later and produces flat R2 key names that are harder to lifecycle-manage.

**Trade-offs / consequences.** XHR is legacy API but stable and universally supported. If browser upload progress via Streams matures, this can be swapped without touching the route or action. Adding `projectId` to the sign route means the client must know the project ID before signing — acceptable since the upload widget is always rendered inside a project page.

---

## 2026-05-01 — R2 CORS must be configured manually in the Cloudflare dashboard

**Context.** Browser PUTs to R2 require appropriate CORS headers; there is no IaC or CLI path for R2 CORS in V1.

**Decision.** Document the required CORS policy (PUT + GET, Content-Type + Content-Length headers, allowed origins) and configure it manually in the Cloudflare dashboard once per environment. No code change needed.

**Alternatives considered.** Cloudflare Wrangler CLI (`wrangler r2 bucket cors put`) — available but adds a Wrangler dependency and CI step before we have CI-driven deployments. Deferred to V2.

**Trade-offs / consequences.** Onboarding a new developer requires a manual step that isn't captured in code. Mitigated by documenting it in SETUP.md and in the verification checklist.

---

## 2026-05-01 — Webhook handler uses a class-field spy, not a `vi.fn()` constructor mock

**Context.** Writing tests for the Clerk webhook handler required mocking `new Webhook(secret).verify(...)`. In Vitest 4.x, `vi.fn().mockReturnValue(obj)` does not propagate through `new` as it does in Jest — the `new` expression returns a fresh object, not `obj`.

**Decision.** Mock `svix` with a real `class MockWebhook` (via `vi.mock()` factory) whose `verify` field is a `vi.hoisted()` spy. Every instance shares the same spy, which tests can control via `svixVerify.mockReturnValue(...)`.

**Alternatives considered.** `mockImplementation(function() { return obj })` (regular function) — also works but requires casting `as never` on the implementation argument. The class approach is cleaner and matches Vitest's own documented pattern for class mocks.

**Trade-offs / consequences.** All test instances of `Webhook` share a single `verify` spy. Tests must `vi.clearAllMocks()` between runs (already done in `beforeEach`). Adding more instance methods in future would require adding them to `MockWebhook`.

---

## 2026-05-01 — V1 schema: 7 tables, internal UUID PK separate from clerk_id

**Context.** Phase 2 needed a real database schema to replace the Phase 1 `health_check` placeholder.

**Decision.** Seven tables: `users`, `workspaces`, `workspace_members`, `projects`, `tracks`, `audio_files`, `comments`, `project_versions`. Each user-facing entity uses an internal UUID primary key. The `users` table has a separate `clerk_id` column (unique, indexed) that maps to Clerk's user ID.

**Alternatives considered.** Using `clerk_id` directly as the PK — simpler but couples every FK to Clerk's ID format and makes joins slower (string vs UUID).

**Trade-offs / consequences.** One extra lookup when translating Clerk IDs to internal IDs (e.g., in the webhook handler). The escape hatch for switching auth providers is straightforward: update `clerk_id` to point to the new provider's user ID without touching any FKs.

---

## 2026-05-01 — Webhook auto-creates personal workspace on user.created

**Context.** When a user signs up via Clerk, the `user.created` webhook fires. The dashboard would be empty without a default workspace.

**Decision.** The webhook handler wraps user + workspace + workspace_member creation in a single Drizzle transaction. If the user insert returns 0 rows (conflict on `clerk_id` = replay), the handler returns early without creating a workspace — making it safe for Clerk's automatic webhook replays.

**Alternatives considered.** Defer workspace creation to an explicit UI action. Rejected for V1 because an empty dashboard on first login is confusing.

**Trade-offs / consequences.** Every new user automatically gets a "My Projects" workspace. In V2, if we add organization workspaces at signup, we'll need to decide whether to also create the personal workspace or skip it.

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
