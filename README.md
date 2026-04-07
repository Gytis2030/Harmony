# Harmony V1

Harmony is a browser-based collaborative workspace for remote music production review. V1 focuses on track uploads, timeline comments, version snapshots, and team collaboration.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Supabase (Auth + Postgres + Storage)
- WaveSurfer.js for waveform rendering
- Zustand for local timeline state
- Zod + React Hook Form

## What is implemented

- Email/password auth (`/login`)
- Protected app shell (`/dashboard`, `/projects/[projectId]`)
- Project creation with automatic initial version snapshot
- Project membership and role management
- Stem upload flow with signed URLs and progress
- Stem offset editing + auto sync
- Timeline comments with resolve/unresolve
- Version creation + restore offsets
- Toast notifications for key user actions
- Loading / empty / error states for key app routes and waveform loading

---

## Local setup

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment

Create `.env.local` in the repo root:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<optional-service-role-key>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Optional:

- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`

---

## Supabase setup

### 1) Create project and enable Email auth

- In Supabase Dashboard, create a project.
- Go to **Authentication → Providers → Email** and enable Email auth.

### 2) Apply SQL migration

Use the migration in `supabase/migrations/001_init.sql`.

#### Option A: Supabase Dashboard SQL editor

1. Open **SQL Editor**.
2. Paste migration contents from `supabase/migrations/001_init.sql`.
3. Run it.

#### Option B: Supabase CLI

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

### 3) Confirm storage bucket and policies

After migration, verify:

- Storage bucket `tracks` exists and is private.
- Tables exist: `profiles`, `projects`, `project_members`, `project_versions`, `tracks`, `comments`.
- RLS is enabled for those tables.
- Trigger `on_auth_user_created` exists.
- Storage policies for bucket `tracks` exist.

> The migration already creates the `tracks` bucket and storage policies. No manual bucket creation is required unless your environment blocks storage DDL.

---

## Run the app

```bash
npm run dev
```

Open:

- App: `http://localhost:3000`
- Login: `http://localhost:3000/login`

Sign up with email/password, then you should land on `/dashboard`.

---

## Testing & checks

```bash
npm run test
npm run typecheck
npm run lint
```

## Optional dev helper strategy (not required for production use)

If you need demo data quickly, keep helper scripts/SQL external to production migrations (for example a local-only SQL seed file). Harmony does **not** require fake data to run.

---

## Project structure

- `app/` App Router pages, layouts, API handlers
- `components/` feature + shared components
- `lib/` utilities, Supabase clients, validation, audio logic
- `store/` Zustand state
- `types/` DB types
- `supabase/migrations/` schema + policies
- `tests/` lightweight utility tests
