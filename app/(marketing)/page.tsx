import Link from 'next/link'
import AuthNav from '@/components/marketing/AuthNav'

const FEATURES = [
  {
    icon: '🎛',
    title: 'Multi-track timeline',
    body: 'Layer stems side by side on a DAW-style timeline. Zoom in, mute, solo, and adjust levels without leaving the browser.',
  },
  {
    icon: '👥',
    title: 'Real-time collaboration',
    body: 'See who is in the session right now. Cursors, presence, and comments update live — no refresh needed.',
  },
  {
    icon: '💬',
    title: 'Timestamped comments',
    body: 'Pin feedback to any moment on any stem. Reply in threads, resolve when done, reopen if it comes back.',
  },
  {
    icon: '🕰',
    title: 'Version history',
    body: 'Every snapshot is saved. Roll back mix settings to any point without losing the current state.',
  },
]

export default function MarketingHomePage() {
  return (
    <div className="min-h-screen bg-[#08080d] text-slate-100">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-white/5 bg-[#08080d]/90 px-6 py-4 backdrop-blur">
        <span className="font-mono text-lg font-bold tracking-tight text-violet-400">Harmony</span>
        <AuthNav />
      </nav>

      {/* ── Hero ── */}
      <header className="relative overflow-hidden px-6 pb-24 pt-20 text-center">
        {/* retro grid background */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(124,58,237,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.06) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        {/* radial fade over grid */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(124,58,237,0.18) 0%, transparent 70%)',
          }}
        />

        <div className="relative mx-auto max-w-3xl">
          {/* retro VU-meter badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-violet-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
            Now in beta
          </div>

          <h1 className="font-mono text-5xl font-bold leading-tight tracking-tight text-white sm:text-6xl">
            The studio,{' '}
            <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
              online
            </span>
            .
          </h1>

          <p className="mt-6 text-lg leading-relaxed text-slate-400 sm:text-xl">
            Harmony gives producers a shared DAW in the browser. Upload stems, mix together, drop
            comments on any millisecond — no plugins, no exports, no waiting.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/sign-up"
              className="inline-flex h-11 items-center rounded-lg bg-violet-600 px-8 text-sm font-semibold text-white shadow-[0_0_24px_rgba(124,58,237,0.4)] transition hover:bg-violet-500 hover:shadow-[0_0_32px_rgba(124,58,237,0.55)]"
            >
              Start for free
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

      {/* ── Fake console / waveform visual ── */}
      <section className="relative mx-auto max-w-4xl px-6 pb-24">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c15] shadow-2xl">
          {/* window chrome */}
          <div className="flex items-center gap-2 border-b border-white/5 bg-[#0f0f1a] px-4 py-3">
            <div className="h-3 w-3 rounded-full bg-[#ff5f57]" />
            <div className="h-3 w-3 rounded-full bg-[#febc2e]" />
            <div className="h-3 w-3 rounded-full bg-[#28c840]" />
            <span className="ml-3 font-mono text-xs text-slate-500">
              harmony — session in progress
            </span>
          </div>

          {/* fake track rows */}
          {[
            {
              label: 'Kick',
              color: '#7c3aed',
              bars: [0.9, 0.1, 0.85, 0.15, 0.8, 0.1, 0.9, 0.15, 0.85, 0.1, 0.9, 0.2],
            },
            {
              label: 'Bass',
              color: '#06b6d4',
              bars: [0.5, 0.6, 0.55, 0.65, 0.5, 0.6, 0.55, 0.62, 0.5, 0.6, 0.55, 0.65],
            },
            {
              label: 'Synth Lead',
              color: '#22c55e',
              bars: [0.2, 0.7, 0.4, 0.8, 0.3, 0.75, 0.35, 0.8, 0.25, 0.7, 0.4, 0.75],
            },
            {
              label: 'Vocals',
              color: '#f59e0b',
              bars: [0.0, 0.3, 0.65, 0.7, 0.6, 0.75, 0.7, 0.65, 0.6, 0.7, 0.5, 0.0],
            },
          ].map((track) => (
            <div
              key={track.label}
              className="grid border-b border-white/5"
              style={{ gridTemplateColumns: '140px 1fr' }}
            >
              <div className="flex items-center gap-2 border-r border-white/5 bg-[#101018] px-3 py-4">
                <div className="h-3 w-1 rounded-full" style={{ backgroundColor: track.color }} />
                <span className="text-xs font-medium text-slate-300">{track.label}</span>
              </div>
              <div className="flex items-center gap-px px-2 py-4">
                {track.bars.map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-[1px]"
                    style={{
                      height: `${h * 40 + 4}px`,
                      backgroundColor: track.color,
                      opacity: 0.7,
                    }}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* playhead line */}
          <div
            className="pointer-events-none absolute inset-y-10 w-0.5 bg-violet-400 shadow-[0_0_12px_rgba(167,139,250,0.8)]"
            style={{ left: '52%' }}
          />
        </div>
      </section>

      {/* ── Features ── */}
      <section className="mx-auto max-w-4xl px-6 pb-24">
        <h2 className="mb-12 text-center font-mono text-2xl font-bold text-slate-200">
          Everything the studio session needs
        </h2>
        <div className="grid gap-6 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-white/5 bg-[#0f0f1a] p-6 transition hover:border-violet-500/20"
            >
              <div className="mb-3 text-2xl">{f.icon}</div>
              <h3 className="mb-2 text-sm font-semibold text-slate-100">{f.title}</h3>
              <p className="text-sm leading-relaxed text-slate-500">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="border-t border-white/5 px-6 py-24 text-center">
        <h2 className="font-mono text-3xl font-bold text-white">Ready to roll tape?</h2>
        <p className="mt-3 text-slate-500">Free while in beta. No credit card required.</p>
        <Link
          href="/sign-up"
          className="mt-8 inline-flex h-11 items-center rounded-lg bg-violet-600 px-10 text-sm font-semibold text-white shadow-[0_0_24px_rgba(124,58,237,0.4)] transition hover:bg-violet-500"
        >
          Create a free account
        </Link>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 px-6 py-6 text-center text-xs text-slate-600">
        © {new Date().getFullYear()} Harmony. Built for producers.
      </footer>
    </div>
  )
}
