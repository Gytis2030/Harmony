'use client'
import Link from 'next/link'
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs'

export default function AuthNav() {
  return (
    <div className="flex items-center gap-3">
      <SignedOut>
        <SignInButton>
          <button className="text-sm text-slate-300 transition hover:text-white">Sign in</button>
        </SignInButton>
        <SignUpButton>
          <button className="rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500">
            Get started
          </button>
        </SignUpButton>
      </SignedOut>
      <SignedIn>
        <Link
          href="/dashboard"
          className="rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500"
        >
          Go to Dashboard
        </Link>
        <UserButton afterSignOutUrl="/" />
      </SignedIn>
    </div>
  )
}
