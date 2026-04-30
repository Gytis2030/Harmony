# Harmony — Setup Checklist

Work through this top to bottom. Tick boxes as you go. Don't skip the verification steps — finding a problem now is cheap; finding it in Phase 4 is not.

Estimated time: 1.5 – 2 hours, mostly waiting for confirmation emails.

---

## 1. Local development environment

- [ ] **Install Node.js** (v20 LTS or newer). Use `nvm` so you can switch versions later: <https://github.com/nvm-sh/nvm>. After install, run `node -v` — should print `v20.x` or higher.
- [ ] **Install pnpm**: `npm install -g pnpm`. Verify with `pnpm -v`.
- [ ] **Configure Git** (you already have GitHub). In a terminal: `git config --global user.name "Your Name"` and `git config --global user.email "you@example.com"`.
- [ ] **Install a code editor.** VS Code is the safe choice. Cursor is a fork of VS Code with built-in AI — fine to use, but Claude Code in your terminal is what we'll lean on, so don't pay for Cursor Pro yet.
- [ ] **Install Claude Code** if you haven't: <https://docs.claude.com/en/docs/claude-code>. Verify with `claude --version`.
- [ ] **Install a password manager** if you don't have one (1Password, Bitwarden, Apple Passwords). You're about to collect a dozen API keys. Saving them in a notes app is a security incident waiting to happen.

---

## 2. Cloud accounts (create these now, configure them in Phase 1)

For each: sign up, verify email, and store any API keys / secrets in your password manager under a "Harmony" folder. Don't paste them anywhere else yet.

- [ ] **Vercel** — <https://vercel.com>. Sign in with GitHub. Free Hobby plan is fine.
- [ ] **Clerk** — <https://clerk.com>. Create an application called "Harmony". Pick "Email" + "Google" sign-in for now. Save the publishable key and secret key.
- [ ] **Cloudflare** — <https://dash.cloudflare.com/sign-up>. After signup, go to **R2** in the sidebar and enable it (requires adding a payment method but free tier covers our V1 usage). Create a bucket called `harmony-audio`. Generate an R2 API token with read/write to that bucket. Save the access key ID, secret access key, account ID, and bucket name.
- [ ] **Liveblocks** — <https://liveblocks.io>. Create a project called "Harmony". Save the public key and secret key from the project's API keys page.
- [ ] **Supabase Postgres** (using your existing account) — create a new project called `harmony`. Pick the region closest to you. Save the database connection string from **Project Settings → Database → Connection string → URI** (use the "Pooled" version with `pgbouncer=true` for serverless). Save the project's anon and service-role keys too, even though we won't use them initially.
- [ ] **Stripe** — _defer to Phase 7_. Don't create an account yet; you'll forget which test keys you used by then.

---

## 3. Save your secrets safely

Once you have the keys above, create one entry in your password manager called **"Harmony — env vars"** and paste them in this format. This becomes the source of truth — when you set up `.env.local` in Phase 1, you'll copy from here.

```
# Supabase Postgres
DATABASE_URL=

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=harmony-audio

# Liveblocks
NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY=
LIVEBLOCKS_SECRET_KEY=
```

**Never commit a `.env*` file to Git.** When we scaffold the project, the very first thing the `.gitignore` will do is exclude these. If you ever accidentally commit one, rotate every key immediately.

---

## 4. Claude Code configuration

- [ ] In a terminal in your `Harmony` folder, run `claude` to start a session. Confirm it picks up `CLAUDE.md` automatically (it'll mention it on startup).
- [ ] Install the **context7** MCP server: `claude mcp add context7`. Test by asking Claude in a session: "Use context7 to fetch the latest Next.js App Router routing docs." If it pulls real docs, you're set.
- [ ] _(Optional, skip for now)_ claude-mem and Playwright MCP. Add these in week 2 once you've felt the limits without them.
- [ ] Bookmark the four key shortcuts:
  - `Shift+Tab` twice → Plan Mode
  - `/clear` → reset context between unrelated tasks
  - `/compact` → summarize a long conversation to free context
  - `/model` → switch between Sonnet (default) and Opus (hard problems)

---

## 5. GitHub repo

- [ ] On GitHub, create a new **private** repo called `harmony`. Don't add a README, .gitignore, or license — Claude will generate those during scaffolding.
- [ ] Don't `git init` locally yet — Phase 1 handles that as part of scaffolding.

---

## 6. Verification

Before moving on, confirm:

- [ ] `node -v` ≥ 20, `pnpm -v` works, `claude --version` works.
- [ ] You can log into all five service dashboards (Vercel, Clerk, Cloudflare, Liveblocks, Supabase) without resetting passwords.
- [ ] Your password manager has the "Harmony — env vars" entry filled in.
- [ ] The empty GitHub repo exists and you know its SSH URL.

When all six boxes above are ticked, you're ready for Phase 1 (project scaffolding). Run `/clear` in Claude Code, paste the Phase 1 prompt, and go.

---

## What we deferred and why

- **Stripe** — Phase 7. Test keys go stale and you'll just confuse yourself.
- **Domain name** — buy after V1 is working. Picking a name when the product is half-built tends to lock you into a name you'll hate.
- **Email sending (Resend, Postmark)** — Clerk handles auth emails for us in V1. Add a transactional email provider when we need it (likely Phase 6 for comment notifications).
- **Analytics (PostHog, Plausible)** — Phase 7. Don't optimize what doesn't exist yet.
- **Error tracking (Sentry)** — Phase 7. Same reasoning.
