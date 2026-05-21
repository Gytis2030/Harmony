'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Search, Archive, MoreHorizontal, Clock, Activity, Layers, FolderOpen } from 'lucide-react'
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
  owner: 'bg-violet-500/12 text-violet-300 ring-1 ring-violet-500/20',
  editor: 'bg-blue-500/12 text-blue-300 ring-1 ring-blue-500/20',
  commenter: 'bg-amber-500/12 text-amber-300 ring-1 ring-amber-500/20',
  viewer: 'bg-slate-500/12 text-slate-400 ring-1 ring-slate-500/15',
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${ROLE_BADGE[role] ?? ROLE_BADGE.viewer}`}
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
      return 'left a timestamped note'
    case 'comment.replied':
      return 'replied to a comment'
    case 'comment.resolved':
      return 'resolved a comment'
    case 'comment.reopened':
      return 'reopened a comment'
    case 'version.created':
      return `saved revision${typeof metadata?.versionName === 'string' ? ` "${metadata.versionName}"` : ''}`
    case 'version.restored':
      return 'restored a revision'
    case 'share_link.created':
      return 'created a share link'
    case 'share_link.accessed':
      return 'accessed via share link'
    default:
      return type.replace('.', ' ')
  }
}

const WAVEFORM_HEIGHTS = [0.4, 0.7, 0.9, 0.6, 1.0, 0.8, 0.5, 0.7, 0.9, 0.6]

function MiniWaveform({ color = '#7c3aed' }: { color?: string }) {
  return (
    <div className="flex shrink-0 items-end gap-px" style={{ width: 28, height: 18 }}>
      {WAVEFORM_HEIGHTS.map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm opacity-50"
          style={{ height: `${h * 100}%`, backgroundColor: color }}
        />
      ))}
    </div>
  )
}

const WAVEFORM_COLORS = ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#f97316']

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
        className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-600 transition hover:bg-white/[0.06] hover:text-slate-300 disabled:opacity-50"
        aria-label="Project options"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-50 min-w-[9rem] overflow-hidden rounded-xl border border-white/[0.1] bg-[#141924] py-1 shadow-2xl">
            <button
              type="button"
              onClick={handleArchive}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.05] hover:text-white"
            >
              <Archive className="h-3.5 w-3.5 text-slate-500" />
              Archive room
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
    {
      label: 'Project rooms',
      value: allProjects.length,
      icon: <FolderOpen className="h-4 w-4 text-violet-400" />,
    },
    {
      label: 'Owned by me',
      value: allProjects.filter((p) => p.isOwned).length,
      icon: <Layers className="h-4 w-4 text-cyan-400" />,
    },
    {
      label: 'Shared with me',
      value: allProjects.filter((p) => !p.isOwned).length,
      icon: (
        <svg
          className="h-4 w-4 text-amber-400"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      ),
    },
    {
      label: 'Total stems',
      value: totalStems,
      icon: (
        <svg
          className="h-4 w-4 text-emerald-400"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
          />
        </svg>
      ),
    },
  ]

  return (
    <div className="space-y-8">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-white/[0.07] bg-[#0d1018] px-5 py-4"
          >
            <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03]">
              {stat.icon}
            </div>
            <p className="text-2xl font-bold tabular-nums text-slate-100">{stat.value}</p>
            <p className="mt-0.5 text-xs text-slate-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Search + filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
          <input
            type="text"
            placeholder="Search rooms…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] py-2.5 pl-9 pr-3 text-sm text-slate-100 placeholder-slate-600 focus:border-violet-500/40 focus:outline-none focus:ring-1 focus:ring-violet-500/30"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5 rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
            {(['all', 'mine', 'shared'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  tab === t
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-200'
                }`}
              >
                {t === 'all' ? 'All' : t === 'mine' ? 'Owned' : 'Shared'}
              </button>
            ))}
          </div>
          <a
            href="#activity"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-xs font-medium text-slate-500 transition hover:border-white/[0.14] hover:text-slate-300"
          >
            <Activity className="h-3.5 w-3.5" />
            Activity
          </a>
        </div>
      </div>

      {/* Recent section */}
      {recent.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-slate-600">
            <Clock className="h-3.5 w-3.5" />
            Recent
          </h2>
          <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0d1018]">
            {recent.map((p, idx) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className={`flex items-center gap-4 px-5 py-4 transition hover:bg-white/[0.04] ${idx !== 0 ? 'border-t border-white/[0.05]' : ''}`}
              >
                <MiniWaveform color={WAVEFORM_COLORS[idx % WAVEFORM_COLORS.length]} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-200">
                  {p.name}
                </span>
                <div className="hidden items-center gap-4 sm:flex">
                  <RoleBadge role={p.role} />
                  <span className="w-16 text-right font-mono text-xs tabular-nums text-slate-600">
                    {p.stemCount === 1 ? '1 stem' : `${p.stemCount} stems`}
                  </span>
                  <span className="w-20 text-right text-xs text-slate-600">
                    {formatRelativeDate(p.updatedAt)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* My rooms table */}
      {(tab === 'all' || tab === 'mine') && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-slate-600">
            <FolderOpen className="h-3.5 w-3.5" />
            My rooms
          </h2>
          {myProjects.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.07] bg-[#0d1018] px-6 py-12 text-center">
              <p className="text-sm text-slate-600">
                {search
                  ? `No rooms match "${search}".`
                  : 'You have no rooms yet. Create one to get started.'}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0d1018]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-600">
                      Room
                    </th>
                    <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-600">
                      Role
                    </th>
                    <th className="hidden px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-widest text-slate-600 sm:table-cell">
                      Stems
                    </th>
                    <th className="hidden px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-widest text-slate-600 sm:table-cell">
                      Updated
                    </th>
                    <th className="w-10 px-3 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {myProjects.map((p, idx) => (
                    <tr
                      key={p.id}
                      className={`group transition hover:bg-white/[0.04] ${idx !== 0 ? 'border-t border-white/[0.04]' : ''}`}
                    >
                      <td className="max-w-0 px-5 py-4">
                        <Link
                          href={`/projects/${p.id}`}
                          className="block truncate font-medium text-slate-200 transition hover:text-violet-300"
                        >
                          {p.name}
                        </Link>
                      </td>
                      <td className="px-3 py-4">
                        <RoleBadge role={p.role} />
                      </td>
                      <td className="hidden px-3 py-4 text-right font-mono text-xs tabular-nums text-slate-600 sm:table-cell">
                        {p.stemCount}
                      </td>
                      <td className="hidden px-3 py-4 text-right text-xs text-slate-600 sm:table-cell">
                        {formatRelativeDate(p.updatedAt)}
                      </td>
                      <td className="px-3 py-4 text-right">
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

      {/* Shared rooms table */}
      {(tab === 'all' || tab === 'shared') && (
        <section>
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-600">
            Shared with me
          </h2>
          {sharedProjects.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.07] bg-[#0d1018] px-6 py-12 text-center">
              <p className="text-sm text-slate-600">
                {search
                  ? `No shared rooms match "${search}".`
                  : 'Rooms shared with you will appear here.'}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0d1018]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-600">
                      Room
                    </th>
                    <th className="hidden px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-600 sm:table-cell">
                      Owner
                    </th>
                    <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-600">
                      Your role
                    </th>
                    <th className="hidden px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-widest text-slate-600 sm:table-cell">
                      Stems
                    </th>
                    <th className="hidden px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-widest text-slate-600 sm:table-cell">
                      Updated
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sharedProjects.map((p, idx) => (
                    <tr
                      key={p.id}
                      className={`group transition hover:bg-white/[0.04] ${idx !== 0 ? 'border-t border-white/[0.04]' : ''}`}
                    >
                      <td className="max-w-0 px-5 py-4">
                        <Link
                          href={`/projects/${p.id}`}
                          className="block truncate font-medium text-slate-200 transition hover:text-violet-300"
                        >
                          {p.name}
                        </Link>
                      </td>
                      <td className="hidden px-3 py-4 text-xs text-slate-500 sm:table-cell">
                        {p.ownerName ?? '—'}
                      </td>
                      <td className="px-3 py-4">
                        <RoleBadge role={p.role} />
                      </td>
                      <td className="hidden px-3 py-4 text-right font-mono text-xs tabular-nums text-slate-600 sm:table-cell">
                        {p.stemCount}
                      </td>
                      <td className="hidden px-3 py-4 text-right text-xs text-slate-600 sm:table-cell">
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
        <h2 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-slate-600">
          <Activity className="h-3.5 w-3.5" />
          Recent activity
        </h2>
        {activity.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.07] bg-[#0d1018] px-6 py-10 text-center">
            <p className="text-sm text-slate-600">
              Activity will appear here as you and your collaborators work on rooms.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0d1018]">
            {activity.map((item, idx) => {
              const actorLabel =
                item.actorUserId === currentUserId ? 'You' : (item.actorName ?? 'Someone')
              return (
                <Link
                  key={item.id}
                  href={`/projects/${item.projectId}`}
                  className={`flex items-start gap-3 px-5 py-4 transition hover:bg-white/[0.04] ${idx !== 0 ? 'border-t border-white/[0.04]' : ''}`}
                >
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-violet-400">
                    <span className="text-[11px] font-bold">{actorLabel[0]?.toUpperCase()}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-400">
                      <span className="font-medium text-slate-200">{actorLabel}</span>{' '}
                      {formatActivityLabel(item.type, item.metadata)}{' '}
                      <span className="text-slate-600">in</span>{' '}
                      <span className="text-slate-400">{item.projectName}</span>
                    </p>
                  </div>
                  <span className="shrink-0 pt-0.5 text-xs text-slate-700">
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
