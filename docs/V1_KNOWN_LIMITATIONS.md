# V1 Known Limitations

This document is for internal use during private beta. Share it with beta testers who ask "why doesn't it do X?" — it sets honest expectations and prevents frustration.

---

## What Harmony V1 Is

Harmony V1 is a **collaborative stem-review workspace**, not a full browser DAW.

It is designed for the moment after you leave your DAW: when you have a stem export or a rough mix and you need to share it with collaborators, collect timestamped feedback, and track versions — without emailing files or losing track of what changed.

It is not designed to replace Ableton, Logic, FL Studio, or Pro Tools.

---

## Current Limitations

### Platform and Device

- **Desktop-first editor.** The stem timeline and waveform editor are designed for a large screen. Phones can load the dashboard and landing page, but the editor is not optimised for touch. A mobile-friendly view is planned for V2.

### Collaboration and Access

- **No email delivery.** Invitations and share links are copy-paste only. When you invite a collaborator, you must send them the invite link manually via email, Slack, WhatsApp, or any other channel. Automated email notifications are not yet wired up.
- **No anonymous (sign-in-free) links.** Share links currently require the recipient to create a Harmony account before they can view or comment. Fully anonymous public links are planned for a future release.

### Billing

- **No billing or subscription system yet.** Harmony V1 is available without payment during the private beta period. Pricing and plans will be introduced before public launch.

### File Handling

- **No DAW import or export.** You cannot import an Ableton Live project, Logic session, FL Studio file, or any other DAW project format. Harmony works with stem exports (WAV, MP3, AIFF) only.
- **No R2 cleanup for removed or archived objects.** When you remove a stem or archive a project, the audio file is marked inactive in the database but the underlying object in cloud storage is not immediately deleted. This is intentional for V1 — no data is permanently lost. Cleanup will be automated before billing goes live.
- **Large files may be memory-heavy.** The browser decodes the full audio file into memory when a stem is loaded. Projects with many long high-quality stems may cause high memory usage on lower-end machines. Streaming or partial decode is planned for V2.

### Audio Engine

- **No plugin support.** Third-party plugins, VSTs, or AU instruments cannot be loaded. Harmony's audio engine handles playback and mix monitoring only.
- **No MIDI.** MIDI editing, programming, or instrument triggering is out of scope for V1.
- **No recording.** You cannot record into Harmony from a microphone or audio interface. All audio must be uploaded as pre-recorded files.

### Features Not in V1

- No AI-assisted features (transcription, feedback summarisation, stem separation, etc.)
- No native mobile app (iOS or Android)
- No mastering or processing chain
- No in-browser instrument or synthesiser
- No marketplace or asset library
- No Ableton, Logic, or FL Studio integration

---

## Known Minor Bugs

| Area          | Description                                                                          | Workaround                                    |
| ------------- | ------------------------------------------------------------------------------------ | --------------------------------------------- |
| Activity feed | Activity after a stem upload may not appear immediately in the feed for other users. | Refresh the page.                             |
| Share links   | Share links require sign-in; fully anonymous access is not yet supported.            | Ask collaborators to create an account first. |

---

## Timing-Aware Collaboration

Harmony V1 does not support stem start offsets, beat grids, tempo maps, or DAW import/export. BPM and time signature fields are reference metadata only — they do not affect playback timing or stem alignment. All stems start at position zero.

The idea of "timing-aware collaboration" (aligning stems to a shared timeline, detecting BPM-locked regions, etc.) is a hypothesis that requires real producer feedback before building. It is documented for future evaluation but is **not on the current roadmap**.

---

## What We're Tracking for V2

The following are not commitments — they are the areas we're watching based on early feedback:

- Email notifications for invites and comments
- Anonymous share links
- Mobile-optimised editor
- Stem streaming (partial decode for large files)
- Automated R2 cleanup on archive/delete
- Billing and plan limits
- Timing-aware collaboration (pending producer feedback on whether stem alignment is a real pain point vs. a nice-to-have)
