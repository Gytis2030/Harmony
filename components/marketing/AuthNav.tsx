'use client'
import Link from 'next/link'
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs'

export default function AuthNav() {
  return (
    <div className="flex items-center gap-3">
      <SignedOut>
        <SignInButton>
          <button className="text-sm font-medium text-slate-400 transition hover:text-slate-100">
            Sign in
          </button>
        </SignInButton>
        <SignUpButton>
          <button className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500">
            Get started
          </button>
        </SignUpButton>
      </SignedOut>
      <SignedIn>
        <Link
          href="/dashboard"
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500"
        >
          Dashboard
        </Link>
        <UserButton afterSignOutUrl="/" />
      </SignedIn>
    </div>
  )
}
