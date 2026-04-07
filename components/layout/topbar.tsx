import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export function Topbar() {
  async function logout() {
    'use server';
    const supabase = createClient();
    await supabase.auth.signOut();
    redirect('/login');
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-4 md:px-6">
      <p className="text-sm text-muted">
        Harmony Workspace
      </p>
      <form action={logout}>
        <button type="submit" className="rounded-lg border border-border px-3 py-1.5 text-sm">
          Logout
        </button>
      </form>
    </header>
  );
}
