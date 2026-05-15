'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Archive, MoreHorizontal } from 'lucide-react'
import { archiveProject } from '@/lib/actions/projects'

interface Props {
  id: string
  name: string
  stemCount: number
  updatedAt: Date
}

function formatRelativeDate(date: Date): string {
  const diff = Date.now() - date.getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days}d ago`
  return date.toLocaleDateString()
}

export default function ProjectCard({ id, name, stemCount, updatedAt }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleArchive(e: React.MouseEvent) {
    e.preventDefault()
    setMenuOpen(false)
    if (!confirm(`Archive "${name}"? It will be hidden from your dashboard.`)) return
    startTransition(async () => {
      await archiveProject(id)
    })
  }

  return (
    <div
      className={`group relative rounded-xl border border-white/10 bg-[#0f0f1a] transition-all hover:border-violet-500/30 hover:shadow-[0_0_24px_rgba(124,58,237,0.12)] ${isPending ? 'opacity-50' : ''}`}
    >
      <Link href={`/projects/${id}`} className="block p-5">
        <p className="truncate text-sm font-semibold text-slate-100">{name}</p>
        <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
          <span>{stemCount === 1 ? '1 stem' : `${stemCount} stems`}</span>
          <span>·</span>
          <span>{formatRelativeDate(updatedAt)}</span>
        </div>
      </Link>

      {/* Three-dot menu */}
      <div className="absolute right-3 top-3">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            setMenuOpen((v) => !v)
          }}
          className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-600 opacity-0 transition hover:bg-white/5 hover:text-slate-300 group-hover:opacity-100"
          aria-label="Project options"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>

        {menuOpen && (
          <>
            {/* backdrop to close menu */}
            <div
              className="fixed inset-0 z-40"
              onClick={(e) => {
                e.preventDefault()
                setMenuOpen(false)
              }}
            />
            <div className="absolute right-0 top-8 z-50 min-w-[9rem] rounded-lg border border-white/10 bg-[#1a1a2e] py-1 shadow-xl">
              <button
                type="button"
                onClick={handleArchive}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white"
              >
                <Archive className="h-4 w-4 text-slate-500" />
                Archive project
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
