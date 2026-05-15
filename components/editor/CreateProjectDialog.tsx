'use client'

import { useRef, useState, useTransition } from 'react'
import { createProject } from '@/lib/actions/projects'
import { Button } from '@/components/ui/button'

interface Props {
  label?: string
}

export function CreateProjectDialog({ label = 'New Project' }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleOpen() {
    setError(null)
    setOpen(true)
    // Focus the input after the dialog renders.
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      try {
        await createProject(formData)
        // createProject calls redirect() on success — code below only runs on error.
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  return (
    <>
      <Button onClick={handleOpen} size="sm">
        {label}
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[#0c0c12] p-6 shadow-2xl">
            <h2 className="mb-4 text-lg font-semibold text-white">New Project</h2>
            <form onSubmit={handleSubmit}>
              <label className="mb-1 block text-sm font-medium text-slate-300" htmlFor="name">
                Project name
              </label>
              <input
                ref={inputRef}
                id="name"
                name="name"
                type="text"
                required
                placeholder="Untitled project"
                className="mb-4 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
              />

              {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={isPending}
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-400 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-md bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
                >
                  {isPending ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

export default CreateProjectDialog
