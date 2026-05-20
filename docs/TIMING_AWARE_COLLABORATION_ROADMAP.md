# Product Strategy Note: Timing-Aware Collaboration

> **Status: Hypothesis — not validated. Do not build from one response.**
>
> This document captures a high-quality insight raised by one advanced beta user. It is worth tracking and testing with more users, but it does not yet justify implementation.

---

## The Hypothesis

One advanced user raised a pointed observation: Harmony may have an opportunity not just as a generic audio review tool, but as a timing-aware collaboration platform for remote music projects.

The specific pain points they described:

- Not all stems start at 0:00. Collaborators often send partial overdubs — a harmony that begins at the chorus, a fill that covers bars 32–36.
- Forcing zero-alignment wastes storage (silence-padded files can be 3–5× larger) and feels clumsy to working producers.
- When a full 3-minute mix coexists with a 30-second overdub, navigation becomes confusing and playback scheduling can feel off.
- Tempo mapping is a real pain point but is widely understood to be too complex to solve quickly.
- MP3 encoding can shift audio by a few milliseconds, which matters more than most users realise for timing-critical overdubs.
- Cross-DAW timing differences (sample-offset rounding, latency compensation, PDC) are a deeper long-term problem that no current tool solves well.

This is a credible observation from someone who knows what they are talking about. It is worth investigating, not immediately building.

---

## Why It Could Matter

If this pain is real and widespread, timing-aware features could differentiate Harmony from generic audio review tools — tools like Samply or Boombox-style platforms that treat files as independent uploads with no shared timeline context.

The claim would be: Harmony is the platform where "drop your overdub starting at bar 32" works as naturally as it does inside a DAW.

**That claim is unverified.** We do not know yet whether this pain is common or niche. It may apply primarily to advanced producers with multi-contributor sessions, and less to the solo-producer segment Harmony's V1 is aimed at.

This could differentiate Harmony from generic audio review tools **if repeated feedback confirms the need.**

---

## Do Not Build This Yet

This document is based on one user's feedback. Before committing engineering time:

- Confirm the pain exists for at least 10–15 more relevant users
- Determine whether it affects the V1 solo-producer segment or primarily multi-contributor sessions
- Understand whether the workaround (pad stems to 0:00 before sharing) is genuinely painful, or just slightly inconvenient

Building timing-aware features before validation risks adding complexity that most users will not use, and may distract from polishing the core beta loop.

---

## Validation Questions

Ask the next 10–15 producer users:

1. Do you usually export all stems from 0:00, or do collaborators sometimes send partial overdubs that begin mid-song?
2. Is placing partial files correctly ever annoying or risky? What do you do today to handle it?
3. When you describe a moment in a song to a collaborator, do you use timestamps, bar numbers, section names (like "chorus"), or DAW markers?
4. Have tempo changes or DAW differences ever caused timing problems when sharing stems with collaborators?
5. Would stem offsets or section markers improve your workflow — or would they feel like overkill?

If multiple users independently describe the same friction, that confirms the hypothesis. If the pain is rare or easily worked around, defer indefinitely.

---

## Possible Future Phases (if validated)

The phases below are conditional. They represent how implementation could be sequenced if user research confirms the pain. None of this is approved work.

---

### Potential Phase 11a — Stem Start Offsets

**Hypothesis:** letting stems live at a non-zero timeline position removes the "awkward silence" problem and unlocks overdub workflows.

**Would require:**

- `start_time_seconds NUMERIC(10,4) NOT NULL DEFAULT 0` on the `tracks` table
- `AudioEngine` scheduling updated to fire each source at the correct offset
- Waveform components rendered at the correct horizontal position
- Project duration recalculated as `max(startTimeSeconds + trackDuration)` across all tracks
- Comments remain anchored to project-timeline seconds — no schema change
- Activity feed adds a `placement_changed` event type
- Version snapshots must include `startTimeSeconds` per track

---

### Potential Phase 11b — Placement Controls

**Hypothesis:** raw second inputs are too clumsy; a "move to playhead" button and nudge controls make placement practical.

**Would require:**

- "Move to playhead" button on track row
- Manual start-time input (MM:SS.mm)
- Nudge left/right (± 0.1 s, ± 1 s)
- Drag-to-reposition: **deferred** (complex hit-testing; only warranted after data model is solid)

---

### Potential Phase 11c — Section Markers

**Hypothesis:** named sections (Intro, Verse, Chorus, Bridge) replace imprecise timestamp language in async comments.

**Would require:**

- New `section_markers` table: `id`, `project_id`, `label`, `position_seconds`, `color`
- Markers rendered as vertical lines on the timeline ruler
- Comment composer gains an optional section tag
- Marker CRUD in a lightweight panel
- Liveblocks broadcast for live marker updates

---

### Potential Phase 11d — Timing-Safe File Guidance

**Hypothesis:** a non-blocking MP3 warning reduces silent timing errors without removing format flexibility.

**Would require:**

- Warning banner in upload UI when MP3 is uploaded to a project with WAV/AIFF stems
- Optional project-level "Primary format" setting that escalates the warning
- No hard blocks — producers decide

---

### Phase 12+ — Musical Timeline (beat grid)

Only relevant if Phases 11a–11d confirm real demand and the user base grows toward multi-contributor professional sessions.

**High-level only:**

- Project-level BPM and time signature
- Bar/beat ruler alongside seconds ruler
- Snap-to-beat for placement
- Comments referencing bar/beat
- Tempo-map import/export: **much later, validate demand first**

---

## Technical Implications (if this becomes roadmap)

### Database

| Change                                                   | Phase |
| -------------------------------------------------------- | ----- |
| `tracks.start_time_seconds NUMERIC(10,4) DEFAULT 0`      | 11a   |
| `section_markers` table                                  | 11c   |
| `projects.bpm`, `projects.time_signature_*`              | 12    |
| Version snapshots include `start_time_seconds` per track | 11a   |
| Activity log: `placement_changed` event type             | 11a   |

### Audio Engine (`lib/audio/audio-engine.ts`)

- `loadTrack()` stores `startTimeSeconds` alongside the decoded buffer
- `play(fromPosition)` computes per-track schedule time: `audioCtx.currentTime + LOOKAHEAD + max(0, startTimeSeconds - fromPosition)`
- If `fromPosition > startTimeSeconds + trackDuration`, skip scheduling (track already ended)
- `seek()` must use the same formula — existing seek logic would be affected
- `getProjectDuration()` returns `max(start + duration)` across loaded tracks

### Waveform Layout (`components/editor/`)

- Each track row passes `startTimeSeconds` and `pixelsPerSecond` to the `Waveform` component
- Waveform renders with `paddingLeft = startTimeSeconds * pixelsPerSecond`
- Timeline ruler width = `projectDuration * pixelsPerSecond` (not just the longest single file)
- Zoom changes must recompute all offsets

### Comments

- No schema change. Comments are anchored to `position_seconds` on the project timeline. This model already handles a timing-aware layout correctly.

### Versions

- `createVersion` snapshot must serialize `startTimeSeconds` per track so a restored version resets placements correctly.

### Activity Feed

- New event: `placement_changed` — records `trackId`, `oldStart`, `newStart`, `userId`, `timestamp`

---

## Recommendation

**Keep polishing the existing beta loop. Do not implement timing-aware features until repeated feedback confirms the pain.**

The insight is worth holding onto and testing. Run the validation questions with the next 10–15 producer users. If the pattern repeats, revisit Phase 11a as a concrete proposal. If it does not, this document can be archived as a considered-and-deferred idea.

_Last updated: 2026-05-19. Revisit after 10–15 more relevant users have given feedback._
