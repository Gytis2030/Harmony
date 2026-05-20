'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Search, Archive, MoreHorizontal, Music2, Clock, Activity } from 'lucide-react'
import { archiveProject } from '@/lib/actions/projects'

export type DashboardProject = {
  id: string
  name: string
  stemCount: number
  updatedAt: string
  createdAt: string
  isOwned: boolean
  role: string
  ownerName: string | null
}

export type DashboardActivityItem = {
  id: string
  projectId: string
  projectName: string
  actorUserId: string | null
  actorName: string | null
  type: string
  metadata: Record<string, unknown> | null
  createdAt: string
}

interface Props {
  allProjects: DashboardProject[]
  activity: DashboardActivityItem[]
  currentUserId: string
}

function formatRelativeDate(iso: string): string {
  const date = new Date(iso)
  const diff = Date.now() - date.getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days}d ago`
  return date.toLocaleDateString()
}

const ROLE_BADGE: Record<string, string> = {
  owner: 'bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/20',
  editor: 'bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/20',
  commenter: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/20',
  viewer: 'bg-slate-500/15 text-slate-400 ring-1 ring-slate-500/20',
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${ROLE_BADGE[role] ?? ROLE_BADGE.viewer}`}
    >
      {role}
    </span>
  )
}

function formatActivityLabel(type: string, metadata: Record<string, unknown> | null): string {
  switch (type) {
    case 'track.uploaded':
      return `uploaded ${typeof metadata?.trackName === 'string' ? `"${metadata.trackName}"` : 'a stem'}`
    case 'comment.created':
      return 'added a comment'
    case 'comment.replied':
      return 'replied to a comment'
    case 'comment.resolved':
      return 'resolved a comment'
    case 'comment.reopened':
      return 'reopened a comment'
    case 'version.created':
      return `created version${typeof metadata?.versionName === 'string' ? ` "${metadata.versionName}"` : ''}`
    case 'version.restored':
      return 'restored a version'
    case 'share_link.created':
      return 'created a share link'
    case 'share_link.accessed':
      return 'accessed via share link'
    default:
      return type.replace('.', ' ')
  }
}

const WAVEFORM_HEIGHTS = [0.4, 0.7, 0.9, 0.6, 1.0, 0.8, 0.5, 0.7, 0.9, 0.6]

function MiniWaveform() {
  return (
    <div className="flex shrink-0 items-end gap-px" style={{ width: 28, height: 20 }}>
      {WAVEFORM_HEIGHTS.map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm bg-violet-500/40"
          style={{ height: `${h * 100}%` }}
        />
      ))}
    </div>
  )
}

function ProjectActionMenu({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleArchive(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setOpen(false)
    if (!confirm(`Archive "${name}"? It will be hidden from your dashboard.`)) return
    startTransition(async () => {
      await archiveProject(id)
    })
  }

  return (
    <div
      className="relative"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-600 transition hover:bg-white/5 hover:text-slate-300 disabled:opacity-50"
        aria-label="Project options"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-50 min-w-[9rem] rounded-lg border border-white/10 bg-[#1a1a2e] py-1 shadow-xl">
            <button
              type="button"
              onClick={handleArchive}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white"
            >
              <Archive className="h-4 w-4 text-slate-500" />
              Archive
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default function DashboardShell({ allProjects, activity, currentUserId }: Props) {
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'all' | 'mine' | 'shared'>('all')

  const filtered = allProjects.filter((p) => {
    const q = search.toLowerCase()
    const matchSearch =
      q === '' || p.name.toLowerCase().includes(q) || (p.ownerName ?? '').toLowerCase().includes(q)
    const matchTab =
      tab === 'all' || (tab === 'mine' && p.isOwned) || (tab === 'shared' && !p.isOwned)
    return matchSearch && matchTab
  })

  const recent = [...filtered]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5)

  const myProjects = filtered.filter((p) => p.isOwned)
  const sharedProjects = filtered.filter((p) => !p.isOwned)
  const totalStems = allProjects.reduce((s, p) => s + p.stemCount, 0)

  const stats = [
    { label: 'Total projects', value: allProjects.length },
    { label: 'My projects', value: allProjects.filter((p) => p.isOwned).length },
    { label: 'Shared with me', value: allProjects.filter((p) => !p.isOwned).length },
    { label: 'Total stems', value: totalStems },
  ]

  return (
    <div className="space-y-8">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-white/10 bg-[#0f0f1a] px-4 py-3"
          >
            <p className="text-2xl font-semibold tabular-nums text-slate-100">{stat.value}</p>
            <p className="mt-0.5 text-xs text-slate-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Search + tab filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search projects…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
            {(['all', 'mine', 'shared'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                  tab === t ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t === 'all' ? 'All' : t === 'mine' ? 'Owned by me' : 'Shared'}
              </button>
            ))}
          </div>
          <a
            href="#activity"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-medium text-slate-400 transition hover:border-white/20 hover:text-slate-200"
          >
            <Activity className="h-3.5 w-3.5" />
            Activity
          </a>
        </div>
      </div>

      {/* Recent section */}
      {recent.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
            <Clock className="h-3.5 w-3.5" />
            Recent
          </h2>
          <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0f0f1a]">
            {recent.map((p, idx) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className={`flex items-center gap-4 px-5 py-3.5 transition hover:bg-white/5 ${idx !== 0 ? 'border-t border-white/5' : ''}`}
              >
                <MiniWaveform />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-100">
                  {p.name}
                </span>
                <div className="hidden items-center gap-4 sm:flex">
                  <RoleBadge role={p.role} />
                  <span className="w-14 text-right text-xs text-slate-500">
                    {p.stemCount === 1 ? '1 stem' : `${p.stemCount} stems`}
                  </span>
                  <span className="w-20 text-right text-xs text-slate-500">
                    {formatRelativeDate(p.updatedAt)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* My Projects table */}
      {(tab === 'all' || tab === 'mine') && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
            <Music2 className="h-3.5 w-3.5" />
            My Projects
          </h2>
          {myProjects.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-[#0f0f1a] px-6 py-10 text-center">
              <p className="text-sm text-slate-500">
                {search
                  ? `No owned projects match "${search}".`
                  : 'You have no projects yet. Create one to get started.'}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0f0f1a]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/8">
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">Name</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-slate-500">Role</th>
                    <th className="hidden px-3 py-3 text-right text-xs font-medium text-slate-500 sm:table-cell">
                      Stems
                    </th>
                    <th className="hidden px-3 py-3 text-right text-xs font-medium text-slate-500 sm:table-cell">
                      Last updated
                    </th>
                    <th className="w-10 px-3 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {myProjects.map((p, idx) => (
                    <tr
                      key={p.id}
                      className={`group transition hover:bg-white/5 ${idx !== 0 ? 'border-t border-white/5' : ''}`}
                    >
                      <td className="max-w-0 px-5 py-3.5">
                        <Link
                          href={`/projects/${p.id}`}
                          className="block truncate font-medium text-slate-100 hover:text-violet-300"
                        >
                          {p.name}
                        </Link>
                      </td>
                      <td className="px-3 py-3.5">
                        <RoleBadge role={p.role} />
                      </td>
                      <td className="hidden px-3 py-3.5 text-right text-xs text-slate-500 sm:table-cell">
                        {p.stemCount}
                      </td>
                      <td className="hidden px-3 py-3.5 text-right text-xs text-slate-500 sm:table-cell">
                        {formatRelativeDate(p.updatedAt)}
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        <ProjectActionMenu id={p.id} name={p.name} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Shared with me table */}
      {(tab === 'all' || tab === 'shared') && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Shared with me
          </h2>
          {sharedProjects.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-[#0f0f1a] px-6 py-10 text-center">
              <p className="text-sm text-slate-500">
                {search
                  ? `No shared projects match "${search}".`
                  : 'Projects shared with you will appear here.'}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0f0f1a]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/8">
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">Name</th>
                    <th className="hidden px-3 py-3 text-left text-xs font-medium text-slate-500 sm:table-cell">
                      Owner
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-slate-500">
                      Your role
                    </th>
                    <th className="hidden px-3 py-3 text-right text-xs font-medium text-slate-500 sm:table-cell">
                      Stems
                    </th>
                    <th className="hidden px-3 py-3 text-right text-xs font-medium text-slate-500 sm:table-cell">
                      Last updated
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sharedProjects.map((p, idx) => (
                    <tr
                      key={p.id}
                      className={`group transition hover:bg-white/5 ${idx !== 0 ? 'border-t border-white/5' : ''}`}
                    >
                      <td className="max-w-0 px-5 py-3.5">
                        <Link
                          href={`/projects/${p.id}`}
                          className="block truncate font-medium text-slate-100 hover:text-violet-300"
                        >
                          {p.name}
                        </Link>
                      </td>
                      <td className="hidden px-3 py-3.5 text-xs text-slate-400 sm:table-cell">
                        {p.ownerName ?? '—'}
                      </td>
                      <td className="px-3 py-3.5">
                        <RoleBadge role={p.role} />
                      </td>
                      <td className="hidden px-3 py-3.5 text-right text-xs text-slate-500 sm:table-cell">
                        {p.stemCount}
                      </td>
                      <td className="hidden px-3 py-3.5 text-right text-xs text-slate-500 sm:table-cell">
                        {formatRelativeDate(p.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Recent Activity */}
      <section id="activity">
        <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
          <Activity className="h-3.5 w-3.5" />
          Recent Activity
        </h2>
        {activity.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-[#0f0f1a] px-6 py-8 text-center">
            <p className="text-sm text-slate-500">
              Activity will appear here as you and your collaborators work on projects.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0f0f1a]">
            {activity.map((item, idx) => {
              const actorLabel =
                item.actorUserId === currentUserId ? 'You' : (item.actorName ?? 'Someone')
              return (
                <Link
                  key={item.id}
                  href={`/projects/${item.projectId}`}
                  className={`flex items-start gap-3 px-5 py-3.5 transition hover:bg-white/5 ${idx !== 0 ? 'border-t border-white/5' : ''}`}
                >
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-500/15">
                    <span className="text-[10px] font-bold text-violet-400">
                      {actorLabel[0]?.toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-300">
                      <span className="font-medium text-slate-100">{actorLabel}</span>{' '}
                      {formatActivityLabel(item.type, item.metadata)}{' '}
                      <span className="text-slate-500">in</span>{' '}
                      <span className="text-slate-300">{item.projectName}</span>
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-600">
                    {formatRelativeDate(item.createdAt)}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
