'use client'

import { useOthers, useSelf, useStatus } from '@/lib/realtime/liveblocks'

interface PresenceAvatarsProps {
  className?: string
  maxVisible?: number
}

export default function PresenceAvatars({ className = '', maxVisible = 3 }: PresenceAvatarsProps) {
  const status = useStatus()
  const self = useSelf()
  const others = useOthers((others) => others)

  // Show a loading skeleton while the room connection is being established
  if (status === 'initial' || status === 'connecting') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="flex -space-x-2">
          <div className="h-8 w-8 animate-pulse rounded-full bg-white/10" />
        </div>
      </div>
    )
  }

  // Deduplicate by user ID — same person in multiple tabs counts as one.
  // Also exclude connections that belong to self (same user, other tabs).
  const selfId = self?.info.id
  const uniqueOtherUsers = [
    ...new Map(others.filter((o) => o.info.id !== selfId).map((o) => [o.info.id, o])).values(),
  ]

  const visibleOthers = uniqueOtherUsers.slice(0, maxVisible)
  const overflow = Math.max(0, uniqueOtherUsers.length - maxVisible)
  const totalOnline = uniqueOtherUsers.length + (self ? 1 : 0)

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {totalOnline > 1 && (
        <span className="hidden text-xs text-slate-600 sm:block">{totalOnline} online</span>
      )}

      <div className="flex -space-x-1.5">
        {visibleOthers.map((other) => (
          <AvatarCircle key={other.info.id} name={other.info.name} color={other.info.color} />
        ))}

        {overflow > 0 && (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1a1d2a] text-[9px] font-semibold text-slate-400 ring-2 ring-[#0a0b12]">
            +{overflow}
          </div>
        )}

        {self && <AvatarCircle name={self.info.name} color={self.info.color} isSelf />}
      </div>
    </div>
  )
}

interface AvatarCircleProps {
  name: string
  color: string
  isSelf?: boolean
}

function AvatarCircle({ name, color, isSelf = false }: AvatarCircleProps) {
  const initial = (name || '?').charAt(0).toUpperCase()
  return (
    <div
      title={name}
      className={[
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white',
        isSelf
          ? 'ring-2 ring-white/20 ring-offset-1 ring-offset-[#0a0b12]'
          : 'ring-2 ring-[#0a0b12]',
      ].join(' ')}
      style={{ backgroundColor: color }}
    >
      {initial}
    </div>
  )
}
