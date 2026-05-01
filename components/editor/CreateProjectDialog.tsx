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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">New Project</h2>
            <form onSubmit={handleSubmit}>
              <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="name">
                Project name
              </label>
              <input
                ref={inputRef}
                id="name"
                name="name"
                type="text"
                required
                placeholder="Untitled project"
                className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />

              {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpen(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isPending}>
                  {isPending ? 'Creating…' : 'Create'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

export default CreateProjectDialog
