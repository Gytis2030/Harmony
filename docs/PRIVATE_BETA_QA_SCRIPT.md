# Private Beta QA Script

Run this checklist before inviting any external beta users. Each section maps to a user role. Complete the Owner section first — it creates the project state that all other roles depend on.

Mark items `[x]` as you go. Note any failures with a short description and the date.

---

## Role: Owner

### Sign Up / Sign In

- [ ] Navigate to the landing page — confirm copy and CTAs load correctly
- [ ] Click "Get started" — redirected to sign-up page
- [ ] Create a new account with a test email
- [ ] Confirm redirect to dashboard after sign-up
- [ ] Sign out, then sign back in — confirm redirect to dashboard

### Dashboard

- [ ] Dashboard loads the project list without error
- [ ] "New project" button is visible and opens the create-project modal
- [ ] Create a project named `Midnight Draft — Demo Session`
- [ ] Project card appears on the dashboard
- [ ] Project card shows project name and creation date

### Upload Stems

- [ ] Open the demo project
- [ ] Upload a stem (any audio file) — progress bar appears during upload
- [ ] Upload completes — stem appears in the timeline
- [ ] Upload 5 more stems — all appear in the timeline
- [ ] Stem names display correctly in the track list

### Playback

- [ ] Press play — all stems play back in sync
- [ ] Press pause — playback stops, playhead holds position
- [ ] Press play again — playback resumes from paused position
- [ ] Drag the playhead to a new position — playback jumps correctly
- [ ] Press stop — playhead returns to 0:00

### Mute / Solo / Volume

- [ ] Click mute on one track — that track goes silent, others continue
- [ ] Click mute again — track unmutes
- [ ] Click solo on one track — only that track is audible
- [ ] Click solo again — all tracks return to normal
- [ ] Adjust track volume slider — level changes audibly
- [ ] Adjust master volume slider — overall level changes

### Comments

- [ ] Click on the timeline at a timestamp — comment input appears
- [ ] Type a comment and submit — comment pin appears on the timeline
- [ ] Comment appears in the comments sidebar
- [ ] Add 4 more comments at different timestamps
- [ ] Click a comment in the sidebar — playhead jumps to that timestamp
- [ ] Reply to a comment — reply appears under the original comment
- [ ] Resolve a comment if resolution is supported — comment state updates

### Versions

- [ ] Open version history panel
- [ ] Create a version named `Rough Mix v1` — version appears in the list
- [ ] Create 3 more versions
- [ ] Click a version — version details are shown
- [ ] Restore an earlier version — project state updates
- [ ] Confirm the restored version is reflected in the timeline

### Invites

- [ ] Open the invite modal
- [ ] Invite a second test email as Editor — invitation is accepted
- [ ] Invite a third test email as Commenter
- [ ] Invite a fourth test email as Viewer
- [ ] Confirm all three appear in the member list with correct roles

### Share Links

- [ ] Generate a Viewer share link — link is copied to clipboard
- [ ] Generate a Commenter share link — link is copied to clipboard
- [ ] Open both links in an incognito window (see share-link role sections below)

### Activity Feed

- [ ] Open the activity feed
- [ ] Confirm upload events appear
- [ ] Confirm comment events appear
- [ ] Confirm version events appear
- [ ] Confirm invite events appear

### Archive / Dashboard

- [ ] Return to the dashboard
- [ ] Archive the demo project
- [ ] Confirm it disappears from the default view
- [ ] Show archived projects — confirm demo project appears
- [ ] Unarchive — confirm it returns to the main list

---

## Role: Editor

Sign in with the Editor test account.

- [ ] Dashboard shows the shared project
- [ ] Open the project — timeline and stems load
- [ ] Upload a new stem — upload succeeds
- [ ] Leave a comment — comment appears
- [ ] Attempt to change member roles — confirm action is blocked
- [ ] Attempt to archive the project — confirm action is blocked (if viewer-only)

---

## Role: Commenter

Sign in with the Commenter test account.

- [ ] Dashboard shows the shared project
- [ ] Open the project — timeline and stems load
- [ ] Play back stems — playback works
- [ ] Leave a comment — comment appears
- [ ] Attempt to upload a stem — confirm action is blocked
- [ ] Attempt to create a version — confirm action is blocked

---

## Role: Viewer

Sign in with the Viewer test account.

- [ ] Dashboard shows the shared project
- [ ] Open the project — timeline and stems load
- [ ] Play back stems — playback works
- [ ] Attempt to leave a comment — confirm action is blocked
- [ ] Attempt to upload a stem — confirm action is blocked

---

## Role: Share-Link Viewer

Open the Viewer share link in an incognito window.

- [ ] Link opens the project view
- [ ] Stems are visible in the timeline
- [ ] Playback works
- [ ] No upload button is visible
- [ ] No comment input is visible (or is disabled)

---

## Role: Share-Link Commenter

Open the Commenter share link in an incognito window.

- [ ] Link opens the project view
- [ ] Stems are visible in the timeline
- [ ] Playback works
- [ ] Comment input is visible
- [ ] Leaving a comment succeeds
- [ ] Comment appears in the Owner's comment list and activity feed

---

## Realtime and Presence

Run these tests with two browser windows open simultaneously (Owner + a second role).

- [ ] Open the same project in two windows
- [ ] Second user's avatar appears in the presence bar of the first window
- [ ] First user leaves a comment — comment appears in the second window without refresh
- [ ] Second user replies — reply appears in the first window without refresh
- [ ] First user creates a version — second user's version list updates
- [ ] First user uploads a stem — second user's timeline updates

---

## Landing Page

- [ ] Landing page loads without console errors
- [ ] Hero copy is readable and positions Harmony correctly
- [ ] "Get started" CTA navigates to sign-up
- [ ] Page renders correctly on a 1280px desktop viewport
- [ ] Page renders correctly on a 375px mobile viewport (basic check — editor is desktop-first)

---

## Mobile Sanity Check (iOS Safari / Chrome Android)

Harmony V1 is desktop-first. These checks verify nothing is catastrophically broken on mobile.

- [ ] Landing page is readable and CTA is tappable
- [ ] Dashboard loads and project list is visible
- [ ] A note is visible or expected in the UI that the editor works best on desktop

---

## Known Failures Log

| Date | Role | Step | Description | Status |
| ---- | ---- | ---- | ----------- | ------ |
|      |      |      |             |        |
