'use client'

interface Props {
  duration: number
  markers: number[]
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function TimelineMarkers({ duration, markers }: Props) {
  const style = { marginLeft: 'var(--waveform-col-left)', marginRight: 'var(--waveform-col-right)' }

  if (duration <= 0) {
    return (
      <div
        className="sticky top-0 z-20 h-9 border-b border-white/10 bg-[#0d0d15]"
        style={style}
        aria-hidden="true"
      />
    )
  }

  return (
    <div
      className="sticky top-0 z-20 h-9 border-b border-white/10 bg-[#0d0d15] text-[10px] tabular-nums text-slate-500"
      style={style}
      aria-hidden="true"
    >
      {markers.map((seconds) => (
        <div
          key={seconds}
          className="absolute top-0 flex h-full items-start border-l border-white/10 pl-1.5 pt-2"
          style={{ left: `${(seconds / duration) * 100}%` }}
        >
          {formatTime(seconds)}
        </div>
      ))}
    </div>
  )
}
