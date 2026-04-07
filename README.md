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

- Authentication-ready flow (`/login`) wired for Supabase
- App shell with sidebar + topbar
- Project dashboard (`/dashboard`) with project creation
- Project session page (`/projects/[projectId]`) with:
  - track upload via Supabase signed upload URL
  - waveform rendering using WaveSurfer
  - track alignment metadata placeholder fields (offset/BPM/duration)
  - timeline comments feed
- Supabase middleware auth guard pattern
- SQL migration for core collaboration schema

## Local setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy env file:
   ```bash
   cp .env.example .env.local
   ```
3. Fill in `.env.local` values from your Supabase project.
4. Create a `tracks` storage bucket in Supabase Storage.
5. Run the SQL migration in `supabase/migrations/001_init.sql`.
6. Start dev server:
   ```bash
   npm run dev
   ```

## Environment variables

Required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Optional (useful for admin/server jobs):

- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`

## Folder structure

- `app/` Next.js App Router pages, layouts, API route handlers
- `components/` shared UI and feature components
- `lib/` env, Supabase clients, validation schemas
- `store/` lightweight client state (Zustand)
- `types/` application types
- `supabase/migrations/` SQL schema migrations
