# Harmony

> Real-time collaboration for music producers. Multi-track timeline, synchronized playback, presence, comments, version history. Think "Google Docs for stem-based music projects."

This file is loaded into every Claude Code session. Keep it under ~200 lines. Update it whenever an architectural decision changes or Claude gets something wrong twice.

---

## Audience for this file

The human owner has no prior software engineering experience and is learning by building. Default to:

- Explaining _why_ alongside _what_ when introducing a new pattern.
- Plan Mode first for anything beyond a one-line change. Wait for approval before writing code.
- Small, reviewable diffs. One concern per commit.
- After implementing something non-trivial, leave a short comment in the code or a note in `DECISIONS.md` so the human can skim later.

If a request is vague ("add comments"), ask one clarifying question before coding. Do not guess silently.

---

## Stack

- **Framework**: Next.js 14 (App Router), TypeScript, React Server Components where it makes sense.
- **Styling**: Tailwind CSS. shadcn/ui for primitives.
- **Database**: Postgres on Supabase (using its managed Postgres only — not Auth, Storage, or Realtime). Drizzle ORM for schema and queries. Use the pooled connection string (`pgbouncer=true`) for serverless.
- **Auth**: Clerk.
- **Storage**: Cloudflare R2 for audio files. Always upload via signed URLs from the browser — never proxy file bytes through API routes.
- **Real-time**: Yjs for CRDT, Liveblocks as the provider (we can self-host later if needed).
- **Audio**: Web Audio API for playback and scheduling. Wavesurfer.js for waveform rendering. Tone.js only if scheduling complexity grows.
- **Payments**: Stripe Checkout + Customer Portal. No custom billing UI.
- **Tests**: Vitest for unit, Playwright for E2E.
- **Hosting**: Vercel (web), Supabase (db), Cloudflare R2 (files), Liveblocks (realtime).
- **CI**: GitHub Actions running lint, typecheck, unit tests on every PR.

When suggesting a new dependency, check it's still maintained and justify the addition in your reply. Use `context7` for current docs on fast-moving libraries (Next.js, Yjs, Web Audio).

---

## Folder structure

```
app/                    Next.js App Router routes
  (marketing)/          Public pages
  (app)/                Authenticated pages
    projects/[id]/      Project editor
  api/                  API routes (signed URLs, webhooks, etc.)
components/
  ui/                   shadcn primitives — do not edit
  timeline/             Timeline + track rows + playhead
  editor/               Project editor shell, toolbars, panels
lib/
  db/                   Drizzle schema, migrations, query helpers
  audio/                Web Audio scheduling, mixing, AudioContext singleton
  realtime/             Yjs document model, Liveblocks bindings
  storage/              R2 signed URL helpers
  billing/              Stripe helpers, plan limits
hooks/                  Reusable React hooks
tests/                  Vitest unit tests, Playwright E2E
```

Keep route handlers thin. Business logic lives in `lib/`.

---

## Conventions

- File names: `kebab-case.ts` for modules, `PascalCase.tsx` for React components.
- Components: function components only, default export at bottom of file.
- Server actions over API routes when the caller is our own UI.
- Never use `any`. If a type is genuinely unknown, use `unknown` and narrow.
- Throw typed errors from `lib/`; catch and translate at the route boundary.
- Audio code lives behind a single `AudioEngine` interface so we can swap implementations.

---

## Common commands

```
pnpm dev              # local dev server
pnpm db:push          # apply Drizzle schema to dev DB
pnpm db:studio        # browse the dev DB
pnpm test             # Vitest
pnpm test:e2e         # Playwright
pnpm lint             # ESLint
pnpm typecheck        # tsc --noEmit
```

---

## Things Claude has gotten wrong before

(Add to this list whenever a misstep happens. It's the highest-leverage section in this file.)

- **next.config.ts is not supported in Next.js 14** — use `next.config.mjs`. The `.ts` extension only works in Next.js 15+.
- **`@clerk/nextjs` v6+ requires Next.js 15+** — pin to `@clerk/nextjs@^5` for this project.
- **`Geist` is not exported by `next/font/google` in Next.js 14** — do not import it. shadcn init adds it automatically but it breaks typecheck. Remove it from `layout.tsx`.
- **drizzle-kit CLI does not auto-load `.env.local`** — `drizzle.config.ts` must call `dotenv.config({ path: '.env.local' })` explicitly at the top.
- **`pnpm dlx shadcn@latest init` picks "base-nova" style (Tailwind v4 only)** — always add `--defaults` or verify `components.json` says `"style": "default"` after init. "base-nova" installs `@base-ui/react`, `shadcn`, `tw-animate-css`, and generates `oklch()` CSS variables — all incompatible with Tailwind v3. Fix: remove those three packages, add `@radix-ui/react-slot`, rewrite `globals.css` with `@tailwind` directives and HSL variables, extend `tailwind.config.ts` with shadcn colour tokens.
- **In `@clerk/nextjs` v5, `auth` inside `clerkMiddleware` is a function, not an object** — the correct call is `auth().protect()`, not `auth.protect()`. The object form (`auth.protect`) only exists in v6+, which requires Next.js 15. Always verify against the installed minor before changing this.

---

## Out of scope for V1 (do not build these yet)

MIDI editing, in-browser synths or instruments, plugin/VST support, real-time microphone streaming, mastering, AI features, mobile native apps, marketplace, Ableton/FL integration. If a request drifts here, flag it and propose deferring to V2.

---

## When in doubt

Ask. A 30-second clarification beats a 30-minute wrong implementation.
