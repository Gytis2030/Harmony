'use client';

import { create } from 'zustand';

type TimelineState = {
  cursorMs: number;
  selectedTrackId: string | null;
  pendingSeekMs: number | null;
  setCursorMs: (value: number) => void;
  setSelectedTrackId: (trackId: string | null) => void;
  requestSeekMs: (value: number) => void;
  clearPendingSeek: () => void;
};

export const useTimelineStore = create<TimelineState>((set) => ({
  cursorMs: 0,
  selectedTrackId: null,
  pendingSeekMs: null,
  setCursorMs: (cursorMs) => set({ cursorMs }),
  setSelectedTrackId: (selectedTrackId) => set({ selectedTrackId }),
  requestSeekMs: (pendingSeekMs) => set({ pendingSeekMs }),
  clearPendingSeek: () => set({ pendingSeekMs: null })
}));
