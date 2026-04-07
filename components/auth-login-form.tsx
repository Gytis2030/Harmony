'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { createClient } from '@/lib/supabase/client';
import { type LoginSchema, loginSchema } from '@/lib/validation/auth';

export function AuthLoginForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema)
  });

  const onSubmit = async (values: LoginSchema) => {
    const supabase = createClient();
    await supabase.auth.signInWithPassword(values);
    window.location.href = '/dashboard';
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm text-muted">Email</label>
        <input {...register('email')} className="w-full rounded-lg border border-border bg-background px-3 py-2" />
        {errors.email ? <p className="mt-1 text-xs text-red-400">{errors.email.message}</p> : null}
      </div>
      <div>
        <label className="mb-1 block text-sm text-muted">Password</label>
        <input type="password" {...register('password')} className="w-full rounded-lg border border-border bg-background px-3 py-2" />
        {errors.password ? <p className="mt-1 text-xs text-red-400">{errors.password.message}</p> : null}
      </div>
      <button disabled={isSubmitting} className="w-full rounded-lg bg-brand px-4 py-2 font-medium disabled:opacity-60">
        {isSubmitting ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  );
}
