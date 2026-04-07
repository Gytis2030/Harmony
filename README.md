# Harmony V1

Harmony is a browser-based collaborative workspace for remote music production review. V1 focuses on tracks, timeline comments, project versions, and team collaboration.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Supabase Auth + Storage + Postgres
- WaveSurfer.js for waveform rendering
- Zustand for local timeline state
- Zod + React Hook Form for validation and forms

## Features in this scaffold

- Email/password auth with login + signup on `/login`
- Protected app shell routes (`/dashboard`, `/projects/*`) with middleware + server guards
- Logout action in the app topbar
- Project dashboard (`/dashboard`) with project creation
- Project session page (`/projects/[projectId]`) with:
  - track upload via Supabase signed upload URL
  - waveform rendering using WaveSurfer
  - timeline comments feed
- SQL migration with required tables, profile auto-provisioning trigger, and strict RLS policies

## Environment variables

Create `.env.local` with:

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

## Supabase setup (exact steps)

1. Create a Supabase project.
2. In Supabase Dashboard, go to **Authentication → Providers → Email** and enable Email auth.
3. In your repo root, install dependencies:
   ```bash
   npm install
   ```
4. Run the SQL migration in `supabase/migrations/001_init.sql`:
   - Option A (Dashboard): open **SQL Editor**, paste migration contents, run.
   - Option B (Supabase CLI):
     ```bash
     supabase link --project-ref <your-project-ref>
     supabase db push
     ```
5. Verify migration side effects:
   - `tracks` private storage bucket exists.
   - Tables exist: `profiles`, `projects`, `project_members`, `project_versions`, `tracks`, `comments`.
   - RLS is enabled on all public tables.
   - Trigger `on_auth_user_created` exists and inserts into `profiles`.
6. Start the app:
   ```bash
   npm run dev
   ```
7. Visit `http://localhost:3000/login`, sign up, then you should be redirected to `/dashboard`.

## Folder structure

- `app/` Next.js App Router pages, layouts, API route handlers
- `components/` shared UI and feature components
- `lib/` env, Supabase clients, validation schemas
- `store/` lightweight client state (Zustand)
- `types/` Supabase database typings
- `supabase/migrations/` SQL schema migrations
