'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload } from 'lucide-react'
import { addTrack } from '@/lib/actions/tracks'
import { Button } from '@/components/ui/button'

type UploadState =
  | { status: 'idle' }
  | { status: 'uploading'; progress: number }
  | { status: 'done' }
  | { status: 'error'; message: string }

interface Props {
  projectId: string
}

export function UploadWidget({ projectId }: Props) {
  const [state, setState] = useState<UploadState>({ status: 'idle' })
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  async function upload(file: File) {
    setState({ status: 'uploading', progress: 0 })

    try {
      // 1. Get presigned PUT URL from our API route.
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

      // 2. PUT the file directly to R2 using XHR for upload progress.
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', url)
        xhr.setRequestHeader('Content-Type', file.type)

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100)
            setState({ status: 'uploading', progress })
          }
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve()
          } else {
            reject(new Error(`R2 upload failed: ${xhr.status} ${xhr.statusText}`))
          }
        }

        xhr.onerror = () => reject(new Error('Network error during upload'))
        xhr.send(file)
      })

      // 3. Write the track + audio_file rows to the DB.
      await addTrack({
        r2Key,
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        projectId,
      })

      setState({ status: 'done' })
      router.refresh()
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Upload failed.',
      })
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) upload(file)
    // Reset input so the same file can be re-selected after an error.
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) upload(file)
  }

  const isUploading = state.status === 'uploading'

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragOver(true)
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={[
          'flex min-h-[68px] items-center justify-between gap-4 rounded-md border border-dashed px-4 py-3 transition-colors',
          isDragOver ? 'border-[#7c3aed] bg-[#7c3aed]/15' : 'border-white/15 bg-white/[0.03]',
          isUploading ? 'pointer-events-none opacity-60' : 'cursor-pointer',
        ].join(' ')}
        onClick={() => !isUploading && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="audio/wav,audio/mpeg"
          className="sr-only"
          onChange={handleFileChange}
          disabled={isUploading}
        />

        {state.status === 'idle' && (
          <>
            <div className="flex min-w-0 items-center gap-3">
              <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded border border-white/10 bg-black/30 text-slate-300">
                <Upload className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-200">
                  Drop a WAV or MP3, or click to browse
                </p>
                <p className="mt-1 text-xs text-slate-500">Max 100 MB</p>
              </div>
            </div>
            <span className="hidden rounded border border-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400 sm:inline-flex">
              Upload
            </span>
          </>
        )}

        {state.status === 'uploading' && (
          <div className="w-full max-w-md">
            <p className="mb-2 text-sm font-medium text-slate-200">
              Uploading... {state.progress}%
            </p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[#7c3aed] transition-all"
                style={{ width: `${state.progress}%` }}
              />
            </div>
          </div>
        )}

        {state.status === 'done' && (
          <p className="text-sm font-medium text-emerald-300">Upload complete</p>
        )}
      </div>

      {state.status === 'error' && (
        <div className="mt-3 flex items-center justify-between rounded-md border border-red-400/30 bg-red-950/30 px-4 py-3">
          <p className="text-sm text-red-200">{state.message}</p>
          <Button
            variant="ghost"
            size="sm"
            className="ml-4 shrink-0 text-red-100 hover:bg-red-400/10 hover:text-white"
            onClick={() => {
              setState({ status: 'idle' })
              inputRef.current?.click()
            }}
          >
            Retry
          </Button>
        </div>
      )}
    </div>
  )
}

export default UploadWidget
