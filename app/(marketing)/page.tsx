import Link from 'next/link'
import AuthNav from '@/components/marketing/AuthNav'

const PAIN_POINTS = [
  {
    label: 'Version chaos',
    body: '"final_FINAL_v3_MASTERED.wav" — your client downloads the wrong one. Again.',
  },
  {
    label: 'Scattered feedback',
    body: 'Revision notes spread across WhatsApp, email, voice memos, and Drive comments.',
  },
  {
    label: 'No shared context',
    body: 'Your mix engineer opens the stems. No notes. No timeline. No version history.',
  },
]

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Create a project room',
    body: 'One room per song or session. Set the BPM, invite collaborators by email, or share a private review link.',
  },
  {
    step: '02',
    title: 'Collect timestamped feedback',
    body: 'Collaborators pin comments to the exact second on the exact stem — directly in the browser, no app needed.',
  },
  {
    step: '03',
    title: 'Save revisions, nothing overwrites',
    body: "Name each snapshot before sending a new mix. Restore any version with one click. Your client's sign-off stays attached to the right mix.",
  },
]

const FEATURES = [
  {
    icon: (
      <svg
        className="h-5 w-5 text-violet-400"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
        />
      </svg>
    ),
    title: 'Timestamped comments that stay put',
    body: 'Pinned to the exact moment on the exact stem. Threaded replies. Resolved when fixed. Never buried in a DM.',
  },
  {
    icon: (
      <svg
        className="h-5 w-5 text-cyan-400"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    title: "Version history you'll actually use",
    body: 'Name every snapshot before you send a new mix. Roll back in one click. Nothing overwrites, nothing disappears.',
  },
  {
    icon: (
      <svg
        className="h-5 w-5 text-emerald-400"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
      </svg>
    ),
    title: 'Private rooms, not public links',
    body: 'Invite by email or generate a scoped review link. Reviewers see one project — not your whole workspace.',
  },
  {
    icon: (
      <svg
        className="h-5 w-5 text-amber-400"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
        />
      </svg>
    ),
    title: "Know when they're reviewing",
    body: "Live presence shows who's in the room right now. You'll know the moment your client opens the session.",
  },
]

// Demo track data for the product preview
const DEMO_TRACKS = [
  {
    label: 'Kick + 808',
    color: '#7c3aed',
    bars: [
      0.9, 0.1, 0.85, 0.1, 0.9, 0.1, 0.88, 0.1, 0.9, 0.1, 0.85, 0.1, 0.9, 0.1, 0.87, 0.1, 0.9, 0.1,
      0.85, 0.1,
    ],
  },
  {
    label: 'Lead Vocal',
    color: '#f59e0b',
    bars: [
      0.0, 0.05, 0.55, 0.72, 0.68, 0.78, 0.73, 0.62, 0.74, 0.7, 0.72, 0.61, 0.52, 0.57, 0.3, 0.08,
      0.0, 0.0, 0.0, 0.0,
    ],
  },
  {
    label: 'Synths',
    color: '#06b6d4',
    bars: [
      0.3, 0.45, 0.4, 0.52, 0.35, 0.5, 0.42, 0.52, 0.38, 0.47, 0.4, 0.52, 0.35, 0.5, 0.4, 0.47, 0.3,
      0.45, 0.4, 0.5,
    ],
  },
  {
    label: 'Mix Ref',
    color: '#10b981',
    bars: [
      0.55, 0.58, 0.6, 0.57, 0.58, 0.6, 0.57, 0.59, 0.6, 0.58, 0.57, 0.6, 0.58, 0.6, 0.57, 0.58,
      0.55, 0.58, 0.6, 0.57,
    ],
  },
]

export default function MarketingHomePage() {
  return (
    <div className="min-h-screen bg-[#07080d] text-slate-100">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-white/[0.06] bg-[#07080d]/90 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/15 ring-1 ring-violet-500/25">
            <svg
              className="h-3.5 w-3.5 text-violet-400"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z"
              />
            </svg>
          </div>
          <span className="text-sm font-semibold tracking-tight text-slate-100">Harmony</span>
        </div>
        <AuthNav />
      </nav>

      {/* ── Hero ── */}
      <header className="relative overflow-hidden px-6 pb-16 pt-20 text-center lg:pb-20 lg:pt-28">
        {/* Subtle grid */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'linear-gradient(rgba(124,58,237,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.04) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />
        {/* Radial violet glow — top */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 80% 50% at 50% -5%, rgba(124,58,237,0.18) 0%, transparent 65%)',
          }}
        />

        <div className="relative mx-auto max-w-3xl">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/8 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-violet-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
            Private beta · No credit card required
          </div>

          <h1 className="text-5xl font-bold leading-[1.1] tracking-tight text-white sm:text-6xl lg:text-7xl">
            One private room
            <br />
            <span className="bg-gradient-to-r from-violet-400 via-violet-300 to-cyan-400 bg-clip-text text-transparent">
              for every mix.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-400 lg:text-xl">
            Upload stems, collect timestamped feedback, and track every revision — without WhatsApp
            threads, Drive links, or version confusion.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/sign-up"
              className="inline-flex h-12 items-center rounded-xl bg-violet-600 px-8 text-sm font-semibold text-white shadow-[0_0_32px_rgba(124,58,237,0.4)] transition hover:bg-violet-500 hover:shadow-[0_0_48px_rgba(124,58,237,0.55)]"
            >
              Create your free room
            </Link>
            <Link
              href="/sign-in"
              className="inline-flex h-12 items-center rounded-xl border border-white/[0.12] px-8 text-sm font-semibold text-slate-300 transition hover:border-white/25 hover:bg-white/[0.04] hover:text-white"
            >
              Sign in
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate-600">
            Free while in private beta · No plugins · No setup
          </p>
        </div>
      </header>

      {/* ── Pain points ── */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <p className="mb-6 text-center text-xs font-semibold uppercase tracking-widest text-slate-600">
          Sound familiar?
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {PAIN_POINTS.map((pain) => (
            <div
              key={pain.label}
              className="rounded-2xl border border-white/[0.07] bg-[#0d1018] px-6 py-5"
            >
              <p className="mb-1.5 text-sm font-medium text-slate-300">{pain.label}</p>
              <p className="text-sm leading-relaxed text-slate-500">{pain.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Product visual ── */}
      <section className="relative mx-auto max-w-5xl px-6 pb-28">
        <div className="overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0d1018] shadow-[0_40px_100px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.04)]">
          {/* Window chrome */}
          <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#0a0c14] px-5 py-3">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-[#ff5f57]" />
              <div className="h-3 w-3 rounded-full bg-[#febc2e]" />
              <div className="h-3 w-3 rounded-full bg-[#28c840]" />
              <span className="ml-3 font-mono text-xs text-slate-500">
                Midnight Draft — Harmony
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden text-[10px] text-slate-600 sm:block">3 online</span>
              <div className="flex -space-x-1.5">
                {['#7c3aed', '#0ea5e9', '#f59e0b'].map((c) => (
                  <div
                    key={c}
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold text-white ring-2 ring-[#0a0c14]"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="hidden rounded-md border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[10px] font-semibold text-violet-300 sm:block">
                Share
              </div>
            </div>
          </div>

          {/* Transport bar preview */}
          <div className="flex items-center gap-3 border-b border-white/[0.05] bg-[#0c0e18] px-5 py-2.5">
            <div className="flex items-center overflow-hidden rounded-md border border-white/[0.08]">
              <div className="flex h-8 w-10 items-center justify-center bg-violet-600">
                <svg className="h-3.5 w-3.5 fill-current text-white" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <div className="flex h-8 w-8 items-center justify-center border-l border-white/[0.08] text-slate-400">
                <svg className="h-3 w-3 fill-current" viewBox="0 0 24 24">
                  <path d="M6 6h12v12H6z" />
                </svg>
              </div>
            </div>
            <div className="rounded border border-white/[0.08] bg-black/20 px-3 py-1 font-mono text-xs tabular-nums text-slate-300">
              1:42 / 3:24
            </div>
            <div className="rounded border border-white/[0.06] bg-black/20 px-3 py-1 text-xs text-slate-500">
              <span className="text-slate-600">Tempo</span>{' '}
              <span className="text-slate-300">140 BPM</span>
              <span className="mx-1.5 text-slate-700">/</span>
              <span className="text-slate-300">4/4</span>
            </div>
          </div>

          {/* Track rows */}
          <div className="relative">
            {DEMO_TRACKS.map((track, trackIdx) => (
              <div
                key={track.label}
                className="grid border-b border-white/[0.05]"
                style={{ gridTemplateColumns: '200px 1fr' }}
              >
                <div className="flex items-center gap-0 border-r border-white/[0.05] bg-[#0d1018]">
                  <div className="h-full w-1 shrink-0" style={{ backgroundColor: track.color }} />
                  <div className="flex min-w-0 flex-1 items-center justify-between px-4 py-3.5">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-slate-200">{track.label}</p>
                      <p className="mt-0.5 text-[10px] text-slate-600">0:42 / 14.2 MB</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="flex h-5 w-6 items-center justify-center rounded border border-white/[0.08] text-[9px] font-semibold text-slate-500">
                        M
                      </div>
                      <div className="flex h-5 w-6 items-center justify-center rounded border border-white/[0.08] text-[9px] font-semibold text-slate-500">
                        S
                      </div>
                    </div>
                  </div>
                </div>
                <div className="relative flex items-center gap-px bg-[#0a0b12] px-3 py-4">
                  {track.bars.map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-[1px]"
                      style={{
                        height: `${h * 40 + 3}px`,
                        backgroundColor: track.color,
                        opacity: 0.6,
                      }}
                    />
                  ))}
                  {/* Comment pin on vocal track at ~42% position */}
                  {trackIdx === 1 && (
                    <div
                      className="pointer-events-none absolute flex items-start gap-2"
                      style={{ left: '42%', top: '-4px' }}
                    >
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-black shadow-lg ring-2 ring-amber-500/30">
                        A
                      </div>
                      <div className="whitespace-nowrap rounded-xl border border-white/[0.1] bg-[#151928] px-3 py-2 shadow-xl ring-1 ring-black/30">
                        <p className="mb-0.5 text-[10px] font-semibold text-slate-200">Alex</p>
                        <p className="text-[10px] text-slate-400">
                          Bring the reverb down just before the drop
                        </p>
                        <p className="mt-1 font-mono text-[9px] text-amber-500">@ 1:42</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Playhead */}
            <div
              className="pointer-events-none absolute bottom-0 top-0 w-px bg-violet-400 shadow-[0_0_10px_rgba(167,139,250,0.6)]"
              style={{ left: 'calc(200px + (100% - 200px) * 0.42)' }}
            />
          </div>

          {/* Bottom bar */}
          <div className="flex items-center justify-between border-t border-white/[0.04] bg-[#0a0c14] px-5 py-2.5">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-violet-500/15 px-2.5 py-1 font-mono text-[10px] font-semibold text-violet-300 ring-1 ring-violet-500/20">
                v4 — Vocals Up
              </span>
              <span className="text-[10px] text-slate-600">2 open · 4 resolved</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-slate-600">0:00</span>
              <div className="h-px w-24 bg-white/[0.06]">
                <div className="h-full w-[42%] bg-violet-500/60" />
              </div>
              <span className="font-mono text-[10px] text-slate-600">3:24</span>
            </div>
          </div>
        </div>
        {/* Caption */}
        <p className="mt-4 text-center text-xs text-slate-600">
          Your client sees this. One link. Their feedback lands exactly where you need it.
        </p>
      </section>

      {/* ── How it works ── */}
      <section className="mx-auto max-w-5xl px-6 pb-28">
        <div className="mb-14 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-violet-500">
            How it works
          </p>
          <h2 className="text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">
            From session to client approval in three steps
          </h2>
        </div>
        <div className="grid gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.04] sm:grid-cols-3">
          {HOW_IT_WORKS.map((step) => (
            <div key={step.step} className="bg-[#0d1018] px-7 py-8">
              <p className="mb-4 font-mono text-xs font-semibold text-violet-500">{step.step}</p>
              <h3 className="mb-3 text-base font-semibold leading-snug text-slate-100">
                {step.title}
              </h3>
              <p className="text-sm leading-relaxed text-slate-500">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="mx-auto max-w-5xl px-6 pb-28">
        <div className="mb-12 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-600">
            Built for the review workflow
          </p>
          <h2 className="text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">
            Not the mixing session
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-slate-500">
            Harmony picks up where your DAW leaves off — after the export, before the chaos.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-white/[0.06] bg-[#0d1018] p-7 transition duration-200 hover:border-white/[0.1] hover:bg-[#111628]"
            >
              <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04]">
                {f.icon}
              </div>
              <h3 className="mb-2.5 text-sm font-semibold text-slate-100">{f.title}</h3>
              <p className="text-sm leading-relaxed text-slate-500">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Closing CTA ── */}
      <section className="border-t border-white/[0.06] px-6 py-28 text-center">
        <div className="mx-auto max-w-lg">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Your next mix.
            <br />
            <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
              One room.
            </span>
          </h2>
          <p className="mx-auto mt-5 max-w-sm text-sm leading-relaxed text-slate-500">
            Stems, timestamped notes, and revision history — all in one private room you can share
            with a single link.
          </p>
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/sign-up"
              className="inline-flex h-12 items-center rounded-xl bg-violet-600 px-10 text-sm font-semibold text-white shadow-[0_0_32px_rgba(124,58,237,0.4)] transition hover:bg-violet-500 hover:shadow-[0_0_48px_rgba(124,58,237,0.55)]"
            >
              Create your free room
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate-600">No credit card. No setup. Cancel anytime.</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.05] px-6 py-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-500/15">
              <svg
                className="h-3 w-3 text-violet-400"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z"
                />
              </svg>
            </div>
            <span className="text-xs font-medium text-slate-600">Harmony</span>
          </div>
          <p className="text-xs text-slate-700">
            © {new Date().getFullYear()} Harmony · Built for independent producers
          </p>
        </div>
      </footer>
    </div>
  )
}
