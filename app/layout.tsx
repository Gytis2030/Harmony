import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

export const metadata: Metadata = {
  title: 'Harmony — Private project rooms for producers',
  description:
    'Upload stems, collect timestamped feedback, and track every revision in one private room per song. No WhatsApp threads. No Drive chaos.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}
