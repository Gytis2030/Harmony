import Link from 'next/link'
import AuthNav from '@/components/marketing/AuthNav'

const PAIN_POINTS = [
  'Feedback buried in voice notes and DMs',
  '"final_FINAL_v3_MASTERED.wav" — which version is this?',
  'Collaborators reviewing the wrong mix',
]

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Create a project room',
    body: 'One room per song. Upload stems, set the BPM, invite who needs to be there. Share a link or add collaborators directly.',
  },
  {
    step: '02',
    title: 'Collect timestamped feedback',
    body: 'Collaborators pin comments to the exact moment on the exact stem. Threaded replies. Resolved when fixed. No app required — just a browser.',
  },
  {
    step: '03',
    title: 'Iterate without losing anything',
    body: "Save a named version before every revision. Restore any snapshot in one click. Your client's approval is always attached to the right mix.",
  },
]

const FEATURES = [
  {
    title: 'Comments that stay put',
    body: 'Pinned to the exact timestamp on the exact stem. Threaded. Resolved when fixed. No more "you know, that bit before the chorus" buried in a DM.',
  },
  {
    title: "Version history you'll actually use",
    body: 'Name every snapshot before you send a new mix. Roll back in one click. Nothing overwrites, nothing disappears.',
  },
  {
    title: 'Private rooms, not public links',
    body: 'Share with a specific email or generate a review link. Reviewers stay in their lane — they see one project, not your whole workspace.',
  },
  {
    title: "Know when they're listening",
    body: "Real-time presence shows who's in the session right now. You'll know the moment your mix engineer opens the project.",
  },
]

// Fake track data for the product visual
const DEMO_TRACKS = [
  {
    label: 'Kick + 808',
    color: '#7c3aed',
    bars: [0.9, 0.1, 0.85, 0.1, 0.9, 0.1, 0.88, 0.1, 0.9, 0.1, 0.85, 0.1, 0.9, 0.1, 0.87, 0.1],
  },
  {
    label: 'Lead Vocal',
    color: '#f59e0b',
    bars: [0.0, 0.1, 0.55, 0.7, 0.65, 0.75, 0.7, 0.6, 0.72, 0.68, 0.7, 0.6, 0.5, 0.55, 0.3, 0.0],
  },
  {
    label: 'Synths',
    color: '#06b6d4',
    bars: [0.3, 0.45, 0.4, 0.5, 0.35, 0.48, 0.42, 0.5, 0.38, 0.45, 0.4, 0.5, 0.35, 0.48, 0.4, 0.45],
  },
  {
    label: 'Mix Ref',
    color: '#10b981',
    bars: [
      0.55, 0.58, 0.6, 0.57, 0.58, 0.6, 0.57, 0.59, 0.6, 0.58, 0.57, 0.6, 0.58, 0.6, 0.57, 0.58,
    ],
  },
]

export default function MarketingHomePage() {
  return (
    <div className="min-h-screen bg-[#07070b] text-slate-100">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-white/[0.06] bg-[#07070b]/90 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-500/20">
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
      <header className="relative overflow-hidden px-6 pb-20 pt-24 text-center">
        {/* Subtle grid */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(124,58,237,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.05) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }}
        />
        {/* Radial violet glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 90% 55% at 50% 0%, rgba(124,58,237,0.22) 0%, transparent 70%)',
          }}
        />

        <div className="relative mx-auto max-w-2xl">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-violet-500/25 bg-violet-500/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-violet-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
            Private beta · No credit card required
          </div>

          <h1 className="text-5xl font-bold leading-tight tracking-tight text-white sm:text-6xl">
            One private room
            <br />
            <span className="bg-gradient-to-r from-violet-400 via-violet-300 to-cyan-400 bg-clip-text text-transparent">
              for every mix.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-slate-400">
            Upload stems, collect timestamped feedback from anyone, and track every revision —
            without WhatsApp threads, Drive links, or version chaos.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/sign-up"
              className="inline-flex h-11 items-center rounded-lg bg-violet-600 px-8 text-sm font-semibold text-white shadow-[0_0_28px_rgba(124,58,237,0.45)] transition hover:bg-violet-500 hover:shadow-[0_0_36px_rgba(124,58,237,0.6)]"
            >
              Create your free account
            </Link>
            <Link
              href="/sign-in"
              className="inline-flex h-11 items-center rounded-lg border border-white/10 px-8 text-sm font-semibold text-slate-300 transition hover:border-white/20 hover:text-white"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      {/* ── Pain strip ── */}
      <section className="mx-auto max-w-4xl px-6 pb-20">
        <div className="grid gap-3 sm:grid-cols-3">
          {PAIN_POINTS.map((pain) => (
            <div
              key={pain}
              className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-5 py-4"
            >
              <p className="text-sm leading-snug text-slate-500">{pain}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Product visual ── */}
      <section className="relative mx-auto max-w-4xl px-6 pb-24">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c15] shadow-[0_32px_80px_rgba(0,0,0,0.6)]">
          {/* Window chrome */}
          <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#0f0f1a] px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-[#ff5f57]" />
              <div className="h-3 w-3 rounded-full bg-[#febc2e]" />
              <div className="h-3 w-3 rounded-full bg-[#28c840]" />
              <span className="ml-3 font-mono text-xs text-slate-500">
                midnight-draft — Harmony
              </span>
            </div>
            {/* Presence avatars */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-600">3 online</span>
              <div className="flex -space-x-1.5">
                {['#7c3aed', '#0ea5e9', '#f59e0b'].map((c) => (
                  <div
                    key={c}
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold text-white ring-2 ring-[#0f0f1a]"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Track rows */}
          <div className="relative">
            {DEMO_TRACKS.map((track, trackIdx) => (
              <div
                key={track.label}
                className="grid border-b border-white/[0.05]"
                style={{ gridTemplateColumns: '120px 1fr' }}
              >
                <div className="flex items-center gap-2 border-r border-white/[0.05] bg-[#101018] px-3 py-3.5">
                  <div
                    className="h-2.5 w-0.5 shrink-0 rounded-full"
                    style={{ backgroundColor: track.color }}
                  />
                  <span className="truncate text-xs text-slate-400">{track.label}</span>
                </div>
                <div className="relative flex items-center gap-px px-2 py-3.5">
                  {track.bars.map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-[1px]"
                      style={{
                        height: `${h * 36 + 3}px`,
                        backgroundColor: track.color,
                        opacity: 0.65,
                      }}
                    />
                  ))}
                  {/* Comment pin on vocal track at ~42% position */}
                  {trackIdx === 1 && (
                    <div
                      className="pointer-events-none absolute flex items-start gap-2"
                      style={{ left: '40%', top: '-6px' }}
                    >
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-black shadow-lg">
                        A
                      </div>
                      <div className="whitespace-nowrap rounded-lg border border-white/10 bg-[#181828] px-3 py-2 shadow-xl">
                        <p className="mb-0.5 text-[10px] font-semibold text-slate-200">Alex</p>
                        <p className="text-[10px] text-slate-400">
                          Bring the reverb down just before the drop
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Playhead */}
            <div
              className="pointer-events-none absolute bottom-0 top-0 w-px bg-violet-400 shadow-[0_0_12px_rgba(167,139,250,0.7)]"
              style={{ left: 'calc(120px + (100% - 120px) * 0.42)' }}
            />
          </div>

          {/* Timeline bar */}
          <div className="flex items-center justify-between border-t border-white/[0.04] bg-[#0f0f1a] px-4 py-2">
            <span className="font-mono text-[10px] text-slate-600">0:00</span>
            <div className="flex items-center gap-2">
              <span className="rounded bg-violet-500/20 px-2 py-0.5 font-mono text-[10px] text-violet-300">
                v4 — Vocals Up
              </span>
              <span className="text-[10px] text-slate-600">2 comments · 4 resolved</span>
            </div>
            <span className="font-mono text-[10px] text-slate-600">3:24</span>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="mx-auto max-w-4xl px-6 pb-24">
        <h2 className="mb-14 text-center text-2xl font-bold tracking-tight text-slate-100">
          How a Harmony session works
        </h2>
        <div className="grid gap-8 sm:grid-cols-3">
          {HOW_IT_WORKS.map((step) => (
            <div key={step.step} className="relative">
              <p className="mb-3 font-mono text-xs font-semibold text-violet-500">{step.step}</p>
              <h3 className="mb-2 text-sm font-semibold text-slate-100">{step.title}</h3>
              <p className="text-sm leading-relaxed text-slate-500">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="mx-auto max-w-4xl px-6 pb-24">
        <div className="mb-12 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-100">
            Built for the review workflow, not the mixing session
          </h2>
          <p className="mt-3 text-sm text-slate-500">
            Harmony is what happens after you leave your DAW.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-white/[0.06] bg-[#0f0f1a] p-6 transition duration-200 hover:border-violet-500/20 hover:bg-[#111122]"
            >
              <h3 className="mb-2 text-sm font-semibold text-slate-100">{f.title}</h3>
              <p className="text-sm leading-relaxed text-slate-500">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Closing CTA ── */}
      <section className="border-t border-white/[0.06] px-6 py-28 text-center">
        <div className="mx-auto max-w-md">
          <h2 className="text-3xl font-bold tracking-tight text-white">
            Your next mix.
            <br />
            <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
              One room.
            </span>
          </h2>
          <p className="mt-4 text-sm text-slate-500">
            Free while in private beta. No setup. No plugins. Just a link.
          </p>
          <Link
            href="/sign-up"
            className="mt-8 inline-flex h-11 items-center rounded-lg bg-violet-600 px-10 text-sm font-semibold text-white shadow-[0_0_28px_rgba(124,58,237,0.4)] transition hover:bg-violet-500 hover:shadow-[0_0_40px_rgba(124,58,237,0.55)]"
          >
            Create your free account
          </Link>
          <p className="mt-4 text-xs text-slate-600">No credit card required.</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.05] px-6 py-6 text-center text-xs text-slate-700">
        © {new Date().getFullYear()} Harmony · Built for independent producers
      </footer>
    </div>
  )
}
