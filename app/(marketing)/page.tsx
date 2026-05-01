import AuthNav from '@/components/marketing/AuthNav'

export default function MarketingHomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="absolute right-6 top-4">
        <AuthNav />
      </div>
      <h1 className="text-4xl font-bold">Harmony</h1>
      <p className="mt-4 text-lg text-gray-600">Real-time collaboration for music producers.</p>
    </main>
  )
}
