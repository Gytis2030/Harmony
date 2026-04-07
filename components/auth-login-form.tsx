'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { createClient } from '@/lib/supabase/client';
import { type LoginSchema, loginSchema, type SignupSchema, signupSchema } from '@/lib/validation/auth';

export function AuthLoginForm() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<LoginSchema | SignupSchema>({
    resolver: zodResolver(mode === 'login' ? loginSchema : signupSchema)
  });

  const onSubmit = async (values: LoginSchema | SignupSchema) => {
    setErrorMessage(null);
    const supabase = createClient();

    if (mode === 'signup') {
      const signupValues = values as SignupSchema;
      const { error } = await supabase.auth.signUp({
        email: signupValues.email,
        password: signupValues.password,
        options: {
          data: {
            full_name: signupValues.fullName ?? null
          }
        }
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }
    } else {
      const loginValues = values as LoginSchema;
      const { error } = await supabase.auth.signInWithPassword(loginValues);
      if (error) {
        setErrorMessage(error.message);
        return;
      }
    }

    window.location.href = '/dashboard';
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {mode === 'signup' ? (
        <div>
          <label className="mb-1 block text-sm text-muted">Full name</label>
          <input {...register('fullName')} className="w-full rounded-lg border border-border bg-background px-3 py-2" />
          {'fullName' in errors && errors.fullName ? <p className="mt-1 text-xs text-red-400">{errors.fullName.message}</p> : null}
        </div>
      ) : null}
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

      {errorMessage ? <p className="text-xs text-red-400">{errorMessage}</p> : null}

      <button disabled={isSubmitting} className="w-full rounded-lg bg-brand px-4 py-2 font-medium disabled:opacity-60">
        {isSubmitting ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Sign up'}
      </button>

      <button
        type="button"
        onClick={() => setMode((current) => (current === 'login' ? 'signup' : 'login'))}
        className="w-full text-sm text-muted underline-offset-2 hover:underline"
      >
        {mode === 'login' ? 'Need an account? Create one' : 'Already have an account? Sign in'}
      </button>
    </form>
  );
}
