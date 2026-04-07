'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { createProjectSchema, type CreateProjectSchema } from '@/lib/validation/project';

export function CreateProjectForm() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<CreateProjectSchema>({ resolver: zodResolver(createProjectSchema) });

  const onSubmit = async (values: CreateProjectSchema) => {
    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values)
    });

    if (response.ok) {
      reset();
      router.refresh();
    }
  };

  return (
    <form className="card space-y-3 p-4" onSubmit={handleSubmit(onSubmit)}>
      <h2 className="text-lg font-medium">Create project</h2>
      <input {...register('name')} placeholder="Project name" className="w-full rounded-lg border border-border bg-background px-3 py-2" />
      {errors.name ? <p className="text-xs text-red-400">{errors.name.message}</p> : null}
      <textarea {...register('description')} placeholder="Description (optional)" className="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2" />
      <button disabled={isSubmitting} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium disabled:opacity-70">
        {isSubmitting ? 'Creating...' : 'Create'}
      </button>
    </form>
  );
}
