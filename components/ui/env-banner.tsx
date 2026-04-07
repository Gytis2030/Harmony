import { hasValidEnv } from '@/lib/env';

export function EnvBanner() {
  if (hasValidEnv) return null;

  return (
    <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-200">
      Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable auth, storage, and database features.
    </div>
  );
}
