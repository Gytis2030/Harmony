'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
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
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragOver(true)
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={[
          'flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors',
          isDragOver ? 'border-black bg-gray-50' : 'border-gray-300 bg-white',
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
            <p className="text-sm font-medium text-gray-700">
              Drop a WAV or MP3 here, or{' '}
              <span className="underline underline-offset-2">click to browse</span>
            </p>
            <p className="mt-1 text-xs text-gray-400">Max 100 MB</p>
          </>
        )}

        {state.status === 'uploading' && (
          <div className="w-full max-w-xs">
            <p className="mb-2 text-sm font-medium text-gray-700">Uploading… {state.progress}%</p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-black transition-all"
                style={{ width: `${state.progress}%` }}
              />
            </div>
          </div>
        )}

        {state.status === 'done' && (
          <p className="text-sm font-medium text-green-600">Upload complete!</p>
        )}
      </div>

      {/* Error banner with retry */}
      {state.status === 'error' && (
        <div className="mt-3 flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{state.message}</p>
          <Button
            variant="ghost"
            size="sm"
            className="ml-4 shrink-0 text-red-700 hover:bg-red-100"
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
