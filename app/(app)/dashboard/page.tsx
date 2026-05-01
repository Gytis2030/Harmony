import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const user = await currentUser()
  if (!user) redirect('/sign-in')

  const email = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-2xl font-semibold">Welcome to Harmony</h1>
      <p className="mt-2 text-gray-600">{email}</p>
    </main>
  )
}
