'use client'

interface Props {
  duration: number
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function markerInterval(duration: number): number {
  if (duration <= 120) return 10
  if (duration <= 600) return 30
  return 60
}

export default function TimelineMarkers({ duration }: Props) {
  const baseClassName =
    'relative h-6 border-b border-gray-100 text-[10px] tabular-nums text-gray-400'
  const style = {
    marginLeft: 'var(--waveform-col-left)',
    marginRight: 'var(--waveform-col-right)',
  }

  if (duration <= 0) {
    return <div className={baseClassName} style={style} aria-hidden="true" />
  }

  const interval = markerInterval(duration)
  const markers: number[] = []
  for (let seconds = 0; seconds <= duration; seconds += interval) {
    markers.push(seconds)
  }

  if (markers[markers.length - 1] !== duration) {
    markers.push(duration)
  }

  return (
    <div className={baseClassName} style={style} aria-hidden="true">
      {markers.map((seconds) => (
        <div
          key={seconds}
          className="absolute top-0 h-full border-l border-gray-200 pl-1"
          style={{ left: `${(seconds / duration) * 100}%` }}
        >
          {formatTime(seconds)}
        </div>
      ))}
    </div>
  )
}
