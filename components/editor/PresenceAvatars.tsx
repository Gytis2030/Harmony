'use client'

import { useOthers, useSelf, useStatus } from '@/lib/realtime/liveblocks'

interface PresenceAvatarsProps {
  className?: string
  maxVisible?: number
}

export default function PresenceAvatars({ className = '', maxVisible = 3 }: PresenceAvatarsProps) {
  const status = useStatus()
  const self = useSelf()
  const others = useOthers()

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

  const visibleOthers = others.slice(0, maxVisible)
  const overflow = Math.max(0, others.length - maxVisible)

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {others.length > 0 && (
        <div className="hidden text-right text-xs text-slate-500 sm:block">
          <p className="font-medium uppercase tracking-wide text-slate-400">Collaborators</p>
          <p>{others.length === 1 ? '1 online' : `${others.length} online`}</p>
        </div>
      )}

      <div className="flex -space-x-2">
        {visibleOthers.map((other) => (
          <AvatarCircle key={other.connectionId} name={other.info.name} color={other.info.color} />
        ))}

        {overflow > 0 && (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1c1c2a] text-[10px] font-semibold text-slate-400 ring-2 ring-[#0c0c12]">
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
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white',
        isSelf
          ? 'ring-2 ring-white/30 ring-offset-1 ring-offset-[#0c0c12]'
          : 'ring-2 ring-[#0c0c12]',
      ].join(' ')}
      style={{ backgroundColor: color }}
    >
      {initial}
    </div>
  )
}
