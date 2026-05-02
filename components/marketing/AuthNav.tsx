'use client'
import Link from 'next/link'
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'

export default function AuthNav() {
  return (
    <div className="flex items-center gap-3">
      <SignedOut>
        <SignInButton>
          <button className="text-sm text-gray-600 hover:text-gray-900">Sign in</button>
        </SignInButton>
        <SignUpButton>
          <button className="rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-gray-800">
            Get started
          </button>
        </SignUpButton>
      </SignedOut>
      <SignedIn>
        <Button asChild size="sm" variant="outline">
          <Link href="/dashboard">Go to Dashboard</Link>
        </Button>
        <UserButton afterSignOutUrl="/" />
      </SignedIn>
    </div>
  )
}
