import { redirect } from 'next/navigation';
import { AuthLoginForm } from '@/components/auth-login-form';
import { createClient } from '@/lib/supabase/server';

export default async function LoginPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    redirect('/dashboard');
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <section className="card w-full p-8">
        <h1 className="text-2xl font-semibold">Welcome to Harmony</h1>
        <p className="mt-2 text-sm text-muted">Sign in or create your account to access your projects.</p>
        <div className="mt-6">
          <AuthLoginForm />
        </div>
      </section>
    </main>
  );
}
