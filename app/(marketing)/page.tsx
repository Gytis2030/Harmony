import Link from 'next/link';
import { EnvBanner } from '@/components/ui/env-banner';

export const dynamic = 'force-dynamic';

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
      <div className="card p-10 shadow-soft">
        <p className="text-sm uppercase tracking-[0.3em] text-muted">Harmony</p>
        <h1 className="mt-4 text-4xl font-semibold leading-tight md:text-5xl">
          Collaborate on tracks with a focused remote audio workspace.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted">
          Upload tracks, review timeline comments, and keep project versions in sync across your team.
        </p>
        <div className="mt-6"><EnvBanner /></div>
        <div className="mt-10 flex gap-4">
          <Link href="/login" className="rounded-lg bg-brand px-5 py-3 font-medium text-white">
            Sign in
          </Link>
          <Link href="/dashboard" className="rounded-lg border border-border px-5 py-3 font-medium text-white/90">
            Open app
          </Link>
        </div>
      </div>
    </main>
  );
}
