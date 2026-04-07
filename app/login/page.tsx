import { AuthLoginForm } from '@/components/auth-login-form';

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <section className="card w-full p-8">
        <h1 className="text-2xl font-semibold">Welcome back to Harmony</h1>
        <p className="mt-2 text-sm text-muted">Sign in to access your projects.</p>
        <div className="mt-6">
          <AuthLoginForm />
        </div>
      </section>
    </main>
  );
}
