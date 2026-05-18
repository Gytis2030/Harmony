'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, Upload, XCircle } from 'lucide-react'
import { addTrack, type CreatedTrack } from '@/lib/actions/tracks'

type FileStatus =
  | { status: 'pending' }
  | { status: 'signing' }
  | { status: 'uploading'; progress: number }
  | { status: 'saving' }
  | { status: 'done' }
  | { status: 'error'; message: string }

interface FileEntry {
  file: File
  status: FileStatus
}

interface Props {
  projectId: string
  onTrackCreated?: (track: CreatedTrack) => void
}

const ACCEPTED = 'audio/wav,audio/mpeg'
const MAX_BYTES = 100 * 1024 * 1024
const CONCURRENCY = 3

async function uploadOne(
  file: File,
  projectId: string,
  onStatus: (s: FileStatus) => void
): Promise<CreatedTrack> {
  onStatus({ status: 'signing' })

  const signRes = await fetch('/api/uploads/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
      sizeBytes: file.size,
      projectId,
    }),
  })

  if (!signRes.ok) {
    const text = await signRes.text()
    throw new Error(text || `Sign request failed (${signRes.status})`)
  }

  const { url, r2Key } = (await signRes.json()) as { url: string; r2Key: string }

  onStatus({ status: 'uploading', progress: 0 })

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', file.type)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        onStatus({ status: 'uploading', progress: Math.round((e.loaded / e.total) * 100) })
    }
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`R2 upload failed: ${xhr.status}`))
    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.send(file)
  })

  onStatus({ status: 'saving' })

  return addTrack({
    r2Key,
    filename: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    projectId,
  })
}

function validateFile(file: File): string | null {
  if (!['audio/wav', 'audio/mpeg', 'audio/mp3'].includes(file.type)) {
    return `${file.name}: unsupported format (WAV/MP3 only)`
  }
  if (file.size > MAX_BYTES) {
    return `${file.name}: exceeds 100 MB limit`
  }
  return null
}

export function UploadWidget({ projectId, onTrackCreated }: Props) {
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const isUploading = entries.some(
    (e) =>
      e.status.status === 'uploading' ||
      e.status.status === 'pending' ||
      e.status.status === 'signing' ||
      e.status.status === 'saving'
  )
  const allDone =
    entries.length > 0 &&
    entries.every((e) => e.status.status === 'done' || e.status.status === 'error')

  function updateEntry(index: number, status: FileStatus) {
    setEntries((cur) => cur.map((e, i) => (i === index ? { ...e, status } : e)))
  }

  async function processFiles(files: File[]) {
    const validated = files.map((f) => ({ file: f, error: validateFile(f) }))
    const initial: FileEntry[] = validated.map(({ file, error }) => ({
      file,
      status: error ? { status: 'error', message: error } : { status: 'pending' },
    }))
    setEntries(initial)

    const pendingIndices = initial
      .map((e, i) => (e.status.status === 'pending' ? i : -1))
      .filter((i) => i >= 0)

    let anySuccess = false

    // Upload in batches to limit concurrency while still parallelizing.
    for (let b = 0; b < pendingIndices.length; b += CONCURRENCY) {
      const batch = pendingIndices.slice(b, b + CONCURRENCY)
      await Promise.all(
        batch.map((i) =>
          uploadOne(initial[i].file, projectId, (s) => updateEntry(i, s))
            .then((track) => {
              updateEntry(i, { status: 'done' })
              anySuccess = true
              onTrackCreated?.(track)
            })
            .catch((err) => {
              updateEntry(i, {
                status: 'error',
                message: err instanceof Error ? err.message : 'Upload failed.',
              })
            })
        )
      )
    }

    // Backstop refresh to keep other tabs and sessions consistent.
    if (anySuccess) router.refresh()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length > 0) processFiles(files)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) processFiles(files)
  }

  function handleReset() {
    setEntries([])
    inputRef.current?.click()
  }

  const idle = entries.length === 0

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragOver(true)
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !isUploading && idle && inputRef.current?.click()}
        className={[
          'flex min-h-[68px] items-center justify-between gap-4 rounded-md border border-dashed px-4 py-3 transition-colors',
          isDragOver ? 'border-[#7c3aed] bg-[#7c3aed]/15' : 'border-white/15 bg-white/[0.03]',
          !isUploading && idle ? 'cursor-pointer' : '',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          multiple
          className="sr-only"
          onChange={handleFileChange}
          disabled={isUploading}
        />

        {idle && (
          <>
            <div className="flex min-w-0 items-center gap-3">
              <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded border border-white/10 bg-black/30 text-slate-300">
                <Upload className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-200">
                  Drop WAV or MP3 stems here, or click to browse
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Multiple files supported · Max 100 MB each
                </p>
              </div>
            </div>
            <span className="hidden rounded border border-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400 sm:inline-flex">
              Upload
            </span>
          </>
        )}

        {!idle && (
          <div className="min-w-0 flex-1 space-y-1.5">
            {entries.map((entry, i) => {
              const s = entry.status
              const spinning =
                s.status === 'pending' ||
                s.status === 'signing' ||
                s.status === 'uploading' ||
                s.status === 'saving'

              const label =
                s.status === 'error'
                  ? s.message
                  : s.status === 'signing'
                    ? `${entry.file.name} — authorising…`
                    : s.status === 'saving'
                      ? `${entry.file.name} — saving…`
                      : entry.file.name

              return (
                <div key={i} className="flex items-center gap-2 text-xs">
                  {s.status === 'done' && (
                    <CheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  )}
                  {s.status === 'error' && (
                    <XCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />
                  )}
                  {spinning && (
                    <div className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p
                      className={[
                        'truncate',
                        s.status === 'done'
                          ? 'text-emerald-300'
                          : s.status === 'error'
                            ? 'text-red-300'
                            : 'text-slate-300',
                      ].join(' ')}
                    >
                      {label}
                    </p>
                    {s.status === 'uploading' && (
                      <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-[#7c3aed] transition-all"
                          style={{ width: `${s.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {allDone && (
        <button
          type="button"
          onClick={handleReset}
          className="mt-2 text-xs text-slate-500 transition hover:text-slate-300"
        >
          Upload more stems
        </button>
      )}
    </div>
  )
}

export default UploadWidget
