---
name: project-premium-redesign
description: Full premium V1 UI redesign — landing page, dashboard, editor — targeting freelance producers/mixing engineers
metadata:
  type: project
---

Completed a full premium UI redesign targeting the ICP (freelance producers, mixing engineers, studio owners). The brief was "Frame.io for music revisions" — not a DAW clone.

**Why:** App was functional but felt early-stage. Landing page was generic, dashboard felt like dev testing, editor was too DAW-like.

**How to apply:** Future UI work should follow these design principles. Do not regress the color palette or surface hierarchy.

## Design system established

Surface hierarchy:

- App bg: `#07080d` (near-black navy)
- Surface 1 (panels): `#0d1018`
- Surface 2 (elevated forms): `#0f1220`
- Surface 3 (track label bg): `#0c0e18`
- Transport bar bg: `#0a0c14`

Borders: `border-white/[0.06]` to `border-white/[0.14]`
Primary text: `text-slate-100` / `text-slate-200`
Secondary text: `text-slate-400` / `text-slate-500`
Muted text: `text-slate-600` / `text-slate-700`
Accent: `violet-600` for CTAs, `violet-500/xx` for subtle highlights

Key conventions:

- Cards: `rounded-2xl` (not `rounded-xl` from before)
- Buttons: `rounded-lg`, `rounded-xl`
- Section labels: `text-[11px] font-semibold uppercase tracking-widest text-slate-600`
- Timestamp/count labels: `font-mono tabular-nums`

## Files changed

- `app/globals.css` — updated dark mode CSS vars to match navy/charcoal palette
- `app/(marketing)/page.tsx` — hero headline `text-7xl` at lg, wider `max-w-5xl`, icons in feature cards, 3-step how-it-works grid, bigger product preview
- `components/marketing/AuthNav.tsx` — cleaner hover states
- `app/(app)/dashboard/page.tsx` — added sticky nav bar with Harmony brand + UserButton
- `components/dashboard/DashboardShell.tsx` — icon stat cards, `rounded-2xl` tables, better section labels
- `components/editor/ProjectEditorWorkspace.tsx` — Share button is now primary `bg-violet-600`, sidebar is `320px` wide (was 300px)
- `components/editor/ProjectTransport.tsx` — slimmer controls (`h-9` play button, `rounded-lg` throughout)
- `components/editor/ProjectTimeline.tsx` — darker bg, reduced grid line opacity
- `components/editor/TrackRow.tsx` — more breathing room (`min-h-[88px]`), cleaner label area, accent bar `w-1`
- `components/editor/TimelineMarkers.tsx` — darker ruler bg, bottom-aligned time labels
- `components/editor/UploadWidget.tsx` — `rounded-xl` dropzone with premium hover glow
- `components/editor/CollaborationSidebar.tsx` — tab labels renamed (Notes, Revisions, Log), forms use `rounded-xl`, comment cards use `rounded-xl`, timestamp shown as `@ M:SS`
- `components/editor/PresenceAvatars.tsx` — smaller avatars (h-7), cleaner presence display

## Logic deliberately untouched

Upload flow, audio engine, comments/versions actions, auth, permissions, Liveblocks realtime, DB schema.
