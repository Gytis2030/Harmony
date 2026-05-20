# V1 Launch Checklist

Run this before opening Harmony to any external beta users. Each section must be fully checked before the next section is attempted.

---

## 1. Environment Variables

### Vercel

- [ ] `DATABASE_URL` — pooled Supabase connection string (`pgbouncer=true` param included)
- [ ] `DIRECT_URL` — direct (non-pooled) Supabase connection string (used by Drizzle migrations only)
- [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — Clerk publishable key for the production instance
- [ ] `CLERK_SECRET_KEY` — Clerk secret key for the production instance
- [ ] `CLERK_WEBHOOK_SECRET` — signing secret for the `/api/webhooks/clerk` endpoint
- [ ] `NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY` — Liveblocks public key
- [ ] `LIVEBLOCKS_SECRET_KEY` — Liveblocks secret key
- [ ] `R2_ACCOUNT_ID` — Cloudflare R2 account ID
- [ ] `R2_ACCESS_KEY_ID` — Cloudflare R2 access key ID
- [ ] `R2_SECRET_ACCESS_KEY` — Cloudflare R2 secret access key
- [ ] `R2_BUCKET_NAME` — name of the R2 bucket
- [ ] `NEXT_PUBLIC_R2_PUBLIC_URL` — public base URL for serving R2 objects (if bucket has public access enabled)

### Verification

- [ ] All env vars are set in Vercel → Settings → Environment Variables for the Production environment
- [ ] No env var uses `:` instead of `=` (a known issue from earlier setup)

---

## 2. Clerk Configuration

- [ ] Production Clerk instance is active (not development instance)
- [ ] Sign-in and sign-up URLs are configured: `/sign-in`, `/sign-up`
- [ ] After-sign-in redirect is set to `/dashboard`
- [ ] After-sign-up redirect is set to `/dashboard`
- [ ] "User API Keys" feature is **disabled** in Clerk Dashboard → Configure → User & Authentication (prevents users from generating personal API tokens unintentionally)

### Clerk Webhook

- [ ] Webhook endpoint is registered in Clerk Dashboard: `https://<your-domain>/api/webhooks/clerk`
- [ ] Webhook events enabled: `user.created`, `user.updated`
- [ ] `CLERK_WEBHOOK_SECRET` in Vercel matches the signing secret shown in Clerk Dashboard
- [ ] Webhook delivery verified: trigger a test sign-up and confirm the user row is created in the database

---

## 3. Supabase / Database

- [ ] All Drizzle migrations have been applied to the production database (`pnpm db:migrate` or via Supabase SQL editor)
- [ ] `users` table exists and has the expected columns
- [ ] `workspaces` table exists
- [ ] `workspace_members` table exists
- [ ] `projects` table exists
- [ ] `tracks` table exists
- [ ] `audio_files` table exists
- [ ] `comments` table exists
- [ ] `versions` table exists
- [ ] `project_invites` table exists
- [ ] `share_links` table exists
- [ ] `project_activities` table exists
- [ ] Connection pooling is enabled (PgBouncer mode) for the serverless connection string

---

## 4. Cloudflare R2

- [ ] R2 bucket exists with the correct name matching `R2_BUCKET_NAME`
- [ ] CORS policy on the bucket allows `PUT` from the Vercel production domain
- [ ] CORS policy allows `GET` from the Vercel production domain (for public audio serving)
- [ ] Test upload: sign a URL via `/api/uploads/sign` and PUT a file — confirm 200 response and file appears in the bucket
- [ ] Test playback: confirm the uploaded file can be fetched via `NEXT_PUBLIC_R2_PUBLIC_URL`

---

## 5. Liveblocks

- [ ] Liveblocks project exists in the Liveblocks dashboard
- [ ] `LIVEBLOCKS_SECRET_KEY` matches the key in the Liveblocks dashboard
- [ ] `NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY` matches the public key
- [ ] Test presence: open the same project in two browser windows — confirm both avatars appear in the presence bar

---

## 6. Test Accounts

- [ ] At least 4 test accounts have been created:
  - Owner account
  - Editor account
  - Commenter account
  - Viewer account
- [ ] All accounts can sign in to the production environment
- [ ] All accounts appear correctly in the Clerk Dashboard user list

---

## 7. Demo Project

- [ ] Demo project `Midnight Draft — Demo Session` has been created under the Owner account
- [ ] All 6 recommended stems have been uploaded (Drums, Bass, Lead Vocal, Backing Vocals, Synths, Reference Mix)
- [ ] At least 5 comments have been added at different timestamps
- [ ] At least 4 versions have been created (Rough Mix v1, Vocals Up, Client Notes Applied, Final Review)
- [ ] At least one version restore has been tested
- [ ] Editor, Commenter, and Viewer roles have been invited and accepted

---

## 8. Manual QA

- [ ] Full QA script in `docs/PRIVATE_BETA_QA_SCRIPT.md` has been completed
- [ ] All roles have been tested (Owner, Editor, Commenter, Viewer, Share-Link Viewer, Share-Link Commenter)
- [ ] Realtime and presence tests have passed
- [ ] No blocking bugs remain in the known failures log

---

## 9. Known Limitations Reviewed

- [ ] `docs/V1_KNOWN_LIMITATIONS.md` has been reviewed and is accurate
- [ ] Any new limitations discovered during QA have been added to the doc

---

## 10. Production Smoke Test

Run `docs/PRODUCTION_SMOKE_TEST.md` immediately after deploying to production. Key items:

- [ ] Landing page loads at the production URL
- [ ] Sign-up flow completes and redirects to dashboard
- [ ] Clerk webhook fires and creates user + workspace rows in the database
- [ ] `GET /api/health` returns `{ "status": "ok" }`
- [ ] A new project can be created
- [ ] A stem can be uploaded via the signed URL flow (WAV and MP3)
- [ ] Playback works in Chrome (desktop)
- [ ] Playback works in Safari (desktop)
- [ ] A comment can be left and appears in the sidebar
- [ ] Realtime comment sync works between two browser windows
- [ ] A version can be created and restored
- [ ] Invite flow works end-to-end (invite → accept → correct permissions)
- [ ] Share link flow works end-to-end (create → open → correct permissions)
- [ ] No console errors on the dashboard or project editor

---

## Sign-Off

| Item                       | Checked by | Date |
| -------------------------- | ---------- | ---- |
| Environment variables      |            |      |
| Clerk configuration        |            |      |
| Database migrations        |            |      |
| R2 bucket and CORS         |            |      |
| Liveblocks                 |            |      |
| Test accounts              |            |      |
| Demo project               |            |      |
| Manual QA complete         |            |      |
| Known limitations reviewed |            |      |
| Production smoke test      |            |      |
