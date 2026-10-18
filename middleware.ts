import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// Explicitly declare public routes so Clerk can identify its own auth pages
// and so webhooks (which use their own svix signature, not Clerk sessions) are reachable.
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks/(.*)',
])

// Signed-in users have no reason to see the marketing page or the auth pages:
// send them straight to their projects. Done in middleware (not in the page) so
// the landing page never renders first and there is no visible flash.
const isSignedOutOnlyRoute = createRouteMatcher(['/', '/sign-in(.*)', '/sign-up(.*)'])

export default clerkMiddleware((auth, req) => {
  if (isSignedOutOnlyRoute(req) && auth().userId) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }
  if (!isPublicRoute(req)) {
    auth().protect()
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
