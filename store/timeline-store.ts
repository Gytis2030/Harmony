'use client';

import { create } from 'zustand';

type TimelineState = {
  cursorMs: number;
  selectedTrackId: string | null;
  setCursorMs: (value: number) => void;
  setSelectedTrackId: (trackId: string | null) => void;
};

export const useTimelineStore = create<TimelineState>((set) => ({
  cursorMs: 0,
  selectedTrackId: null,
  setCursorMs: (cursorMs) => set({ cursorMs }),
  setSelectedTrackId: (selectedTrackId) => set({ selectedTrackId })
}));
