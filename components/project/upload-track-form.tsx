'use client';

import { useMemo, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast-provider';

type UploadTrackFormProps = {
  projectId: string;
  canUpload: boolean;
};

type UploadState = 'queued' | 'uploading' | 'processing' | 'done' | 'error';

type UploadItem = {
  id: string;
  fileName: string;
  progress: number;
  status: UploadState;
  error?: string;
};

type AudioMetadata = {
  durationSec: number | null;
  sampleRate: number | null;
  channelCount: number | null;
};

const ACCEPTED_EXTENSIONS = new Set(['wav', 'mp3', 'aiff', 'aif', 'm4a']);
const MAX_FILE_SIZE_BYTES = 250 * 1024 * 1024;

function getExtension(fileName: string) {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

function isSupportedFile(file: File) {
  return ACCEPTED_EXTENSIONS.has(getExtension(file.name));
}

async function extractAudioMetadata(file: File): Promise<AudioMetadata> {
  const audioContext = new AudioContext();
  try {
    const fileBuffer = await file.arrayBuffer();
    const decoded = await audioContext.decodeAudioData(fileBuffer.slice(0));

    return {
      durationSec: Number.isFinite(decoded.duration) ? Number(decoded.duration.toFixed(3)) : null,
      sampleRate: Number.isFinite(decoded.sampleRate) ? decoded.sampleRate : null,
      channelCount: Number.isFinite(decoded.numberOfChannels) ? decoded.numberOfChannels : null
    };
  } catch {
    return {
      durationSec: null,
      sampleRate: null,
      channelCount: null
    };
  } finally {
    await audioContext.close().catch(() => undefined);
  }
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, mapper: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function uploadFileWithProgress(signedUrl: string, file: File, onProgress: (progress: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
        return;
      }
      reject(new Error('Failed to upload file to storage.'));
    };

    xhr.onerror = () => reject(new Error('Network error while uploading file.'));

    xhr.open('PUT', signedUrl);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.send(file);
  });
}

export function UploadTrackForm({ projectId, canUpload }: UploadTrackFormProps) {
  const router = useRouter();
  const { notify } = useToast();
  const [uploads, setUploads] = useState<UploadItem[]>([]);

  const activeUploads = useMemo(() => uploads.filter((u) => u.status !== 'done' && u.status !== 'error').length, [uploads]);

  const updateUpload = (id: string, updater: (item: UploadItem) => UploadItem) => {
    setUploads((current) => current.map((item) => (item.id === id ? updater(item) : item)));
  };

  const handleFilesSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = '';

    if (!canUpload) return;

    if (selectedFiles.length === 0) return;

    const nextUploads = selectedFiles.map<UploadItem>((file) => ({
      id: crypto.randomUUID(),
      fileName: file.name,
      progress: 0,
      status: 'queued'
    }));

    setUploads((current) => [...nextUploads, ...current]);

    const uploadResults = await mapWithConcurrency(
      selectedFiles,
      3,
      async (file, index) => {
        const itemId = nextUploads[index].id;

        if (!isSupportedFile(file)) {
          updateUpload(itemId, (item) => ({ ...item, status: 'error', error: 'Unsupported file type.' }));
          return false;
        }

        if (file.size > MAX_FILE_SIZE_BYTES) {
          updateUpload(itemId, (item) => ({ ...item, status: 'error', error: 'File exceeds 250MB limit.' }));
          return false;
        }

        try {
          const metadata = await extractAudioMetadata(file);

          updateUpload(itemId, (item) => ({ ...item, status: 'uploading', progress: 0 }));

          const signedUrlResponse = await fetch('/api/uploads/signed-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId, fileName: file.name })
          });

          if (!signedUrlResponse.ok) {
            throw new Error('Unable to initialize upload.');
          }

          const { signedUrl, path } = (await signedUrlResponse.json()) as { signedUrl: string; path: string };

          await uploadFileWithProgress(signedUrl, file, (progress) => {
            updateUpload(itemId, (item) => ({ ...item, status: 'uploading', progress }));
          });

          updateUpload(itemId, (item) => ({ ...item, status: 'processing' }));

          const trackResponse = await fetch('/api/uploads/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId,
              fileName: file.name,
              filePath: path,
              mimeType: file.type || null,
              fileSizeBytes: file.size,
              durationSec: metadata.durationSec,
              sampleRate: metadata.sampleRate,
              channelCount: metadata.channelCount
            })
          });

          if (!trackResponse.ok) {
            throw new Error('Upload succeeded, but track save failed.');
          }

          updateUpload(itemId, (item) => ({ ...item, status: 'done', progress: 100 }));
          return true;
        } catch (error) {
          updateUpload(itemId, (item) => ({
            ...item,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unexpected upload error.'
          }));
          return false;
        }
      }
    );

    const successfulUploads = uploadResults.filter(Boolean).length;
    if (successfulUploads > 0) {
      const snapshotResponse = await fetch(`/api/projects/${projectId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: 'Upload snapshot',
          notes: `Automatic snapshot after successful stem upload batch (${successfulUploads} file${successfulUploads === 1 ? '' : 's'}).`
        })
      });
      if (!snapshotResponse.ok) {
        notify('Tracks uploaded, but auto snapshot failed.', 'error');
      } else {
        notify(`Uploaded ${successfulUploads} track${successfulUploads === 1 ? '' : 's'}.`, 'success');
      }
      router.refresh();
    } else if (selectedFiles.length > 0) {
      notify('No files were uploaded successfully.', 'error');
    }
  };

  return (
    <div className="space-y-3">
      <label className={`inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium ${canUpload ? 'cursor-pointer bg-brand' : 'cursor-not-allowed bg-brand/60 text-white/80'}`}>
        Upload stems
        <input
          className="hidden"
          disabled={!canUpload}
          type="file"
          accept=".wav,.mp3,.aif,.aiff,.m4a,audio/wav,audio/mpeg,audio/x-aiff,audio/aiff,audio/mp4"
          multiple
          onChange={handleFilesSelected}
        />
      </label>
      <p className="text-xs text-muted">Supported: WAV, MP3, AIFF/AIF, M4A (if browser decoding is available). Max 250MB per file.</p>
      {!canUpload ? <p className="text-xs text-muted">You have viewer access, so uploads are disabled.</p> : null}
      {uploads.length > 0 ? (
        <ul className="space-y-2 text-xs">
          {uploads.map((upload) => (
            <li key={upload.id} className="rounded-lg border border-border bg-background p-2">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate font-medium">{upload.fileName}</p>
                <p className="text-muted">
                  {upload.status === 'uploading'
                    ? `${upload.progress}%`
                    : upload.status === 'processing'
                      ? 'Saving track…'
                      : upload.status === 'done'
                        ? 'Uploaded'
                        : upload.status === 'error'
                          ? 'Failed'
                          : 'Queued'}
                </p>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-brand transition-all" style={{ width: `${upload.progress}%` }} />
              </div>
              {upload.error ? <p className="mt-1 text-red-400">{upload.error}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {activeUploads > 0 ? <p className="text-xs text-muted">Uploading {activeUploads} file(s)…</p> : null}
    </div>
  );
}
