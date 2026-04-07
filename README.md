# Harmony V1

Harmony is a browser-based collaboration workspace for remote music production review. V1 is focused on reliability and core review workflows: project management, multi-track playback, comments, offsets, and version snapshots.

## What is fully working in V1

- Email/password authentication (`/login`) with protected app routes.
- Dashboard project creation and search.
- Project membership and role-based collaboration (owner/editor/viewer).
- Signed upload flow for audio tracks with concurrency controls.
- Waveform timeline playback with stop/play/pause behavior and signed URL refresh.
- Manual per-track offset editing and auto-sync offset persistence.
- Timeline comments (create + resolve/unresolve) with project/track integrity checks.
- Version history snapshots and restore-offsets from prior versions.
- Clear user feedback for critical actions via toast + inline status messaging.

## Architecture overview (concise)

- **Frontend (Next.js App Router):**
  - Route groups for marketing and app experiences.
  - Server components fetch project/session data.
  - Client components handle interactive waveform playback, uploads, comments, and collaboration controls.
- **Backend (Next.js route handlers + Supabase):**
  - API routes in `app/api/**` enforce authentication + role checks.
  - Supabase Postgres stores projects, tracks, comments, members, and snapshots.
  - Supabase Storage stores track binaries in a private `tracks` bucket with signed URL access.
- **Data integrity + permissions:**
  - Row Level Security and SQL functions/constraints in `supabase/migrations/**`.
  - Membership checks and offset sync use DB-side RPC for consistency.
- **State + validation:**
  - Local timeline UI state via Zustand.
  - Payload validation with Zod.

## Local setup

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
NEXT_PUBLIC_APP_URL=http://localhost:3000
SUPABASE_SERVICE_ROLE_KEY=<optional-service-role-key>
```

Required:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Optional:
- `NEXT_PUBLIC_APP_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (helpful for privileged server-side operations/debugging)

## Manual Supabase setup still required

1. Create a Supabase project.
2. Enable Email auth provider.
3. Apply **both** migrations:
   - `supabase/migrations/001_init.sql`
   - `supabase/migrations/002_critical_fixes.sql`
4. Confirm:
   - private `tracks` storage bucket exists,
   - table RLS enabled,
   - triggers/functions/policies from both migrations are present.

## Run locally

```bash
npm run dev
```

Then open `http://localhost:3000`.

## Quality checks

```bash
npm run test
npm run typecheck
npm run lint
npm run build
```

## Current V1 limitations

- Real-time collaboration updates are request/refresh based (no live collaborative cursors or presence).
- Offset auto-sync quality depends on source material quality and overlap.
- Track playback and timeline are optimized for review, not full DAW-grade editing/mixing.
- Test suite is currently focused on core utility logic; broader E2E coverage is still limited.
- Node test runner emits module-type warnings unless package/module settings are adjusted.

## Short future roadmap

- Add broader integration/E2E test coverage for key workflows.
- Improve observability (structured logs + action-level diagnostics).
- Expand collaboration UX (activity history and richer role actions).
- Continue tightening Supabase-generated typing across API/data layers.

## Repo structure

- `app/`: routes, layouts, API handlers
- `components/`: feature and UI components
- `lib/`: domain logic, Supabase clients, validation, audio sync helpers
- `store/`: Zustand timeline/session state
- `types/`: shared TS/database types
- `supabase/migrations/`: schema, RLS, and function/policy SQL
- `tests/`: utility tests
