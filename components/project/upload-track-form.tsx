'use client';

import type { ChangeEvent } from 'react';

type UploadTrackFormProps = {
  projectId: string;
};

export function UploadTrackForm({ projectId }: UploadTrackFormProps) {
  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const signedUrlResponse = await fetch('/api/uploads/signed-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, fileName: file.name })
    });

    if (!signedUrlResponse.ok) return;

    const { signedUrl } = (await signedUrlResponse.json()) as { signedUrl: string };

    await fetch(signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'audio/mpeg' },
      body: file
    });

    window.location.reload();
  };

  return (
    <label className="inline-flex cursor-pointer items-center rounded-lg bg-brand px-4 py-2 text-sm font-medium">
      Upload track
      <input className="hidden" type="file" accept="audio/*" onChange={handleUpload} />
    </label>
  );
}
