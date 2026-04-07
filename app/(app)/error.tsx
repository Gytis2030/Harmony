'use client';

export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card mx-auto max-w-2xl space-y-3 p-6">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-sm text-muted">{error.message || 'Unexpected error in the workspace.'}</p>
      <button className="rounded-lg bg-brand px-4 py-2 text-sm font-medium" onClick={reset}>
        Retry
      </button>
    </div>
  );
}
