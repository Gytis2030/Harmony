'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useToast } from '@/components/ui/toast-provider';
import { createProjectSchema, type CreateProjectSchema } from '@/lib/validation/project';

export function CreateProjectForm() {
  const router = useRouter();
  const { notify } = useToast();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<CreateProjectSchema>({ resolver: zodResolver(createProjectSchema) });

  const onSubmit = async (values: CreateProjectSchema) => {
    setSubmitError(null);

    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values)
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      const message = payload?.error ?? 'Failed to create project.';
      setSubmitError(message);
      notify(message, 'error');
      return;
    }

    const payload = (await response.json()) as { id: string };
    reset();
    notify('Project created successfully.', 'success');
    router.push(`/projects/${payload.id}`);
  };

  return (
    <form className="card space-y-3 p-5" onSubmit={handleSubmit(onSubmit)}>
      <h2 className="text-lg font-medium">Create project</h2>
      <p className="text-sm text-muted">Start a new session and capture an initial version snapshot automatically.</p>

      <div>
        <input {...register('name')} placeholder="Project name" className="w-full rounded-lg border border-border bg-background px-3 py-2" />
        {errors.name ? <p className="mt-1 text-xs text-red-400">{errors.name.message}</p> : null}
      </div>

      <div>
        <textarea
          {...register('description')}
          placeholder="Description (optional)"
          className="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2"
        />
        {errors.description ? <p className="mt-1 text-xs text-red-400">{errors.description.message}</p> : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <input
            {...register('bpm', { valueAsNumber: true })}
            type="number"
            min={1}
            max={300}
            placeholder="BPM (optional)"
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          />
          {errors.bpm ? <p className="mt-1 text-xs text-red-400">{errors.bpm.message}</p> : null}
        </div>

        <div>
          <input
            {...register('keySignature')}
            placeholder="Key signature (optional)"
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          />
          {errors.keySignature ? <p className="mt-1 text-xs text-red-400">{errors.keySignature.message}</p> : null}
        </div>
      </div>

      {submitError ? <p className="text-sm text-red-400">{submitError}</p> : null}

      <button disabled={isSubmitting} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium disabled:opacity-70">
        {isSubmitting ? 'Creating...' : 'Create Project'}
      </button>
    </form>
  );
}
