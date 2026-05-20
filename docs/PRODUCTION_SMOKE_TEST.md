# Production Smoke Test

Run this immediately after deploying to the production Vercel environment. It is a quick sanity check — not a full QA pass. For the full QA script see `docs/PRIVATE_BETA_QA_SCRIPT.md`.

Each item should take under 2 minutes. If anything fails, do not open the app to beta users.

---

## Auth

- [ ] Landing page loads at the production URL (no console errors, no 500)
- [ ] `/sign-up` opens without error — complete registration with a fresh email
- [ ] After sign-up, the user is redirected to `/dashboard`
- [ ] Clerk webhook fires: check that the new user row exists in the `users` table and a personal workspace was created in `workspaces`
- [ ] `/sign-out` works and redirects to landing page
- [ ] `/sign-in` with existing credentials works and redirects to `/dashboard`
- [ ] Visiting `/dashboard` while logged out redirects to `/sign-in`
- [ ] Visiting `/projects/<any-id>` while logged out redirects to `/sign-in`

---

## Dashboard

- [ ] Dashboard loads with no console errors
- [ ] "My Projects" section appears if projects exist
- [ ] "Create project" dialog opens and submitting a name creates the project and redirects to the editor
- [ ] Archived projects do not appear on the dashboard

---

## Upload / Playback

- [ ] In the project editor, the upload widget is visible
- [ ] Upload one WAV file — progress bar appears, then the track row appears without a page refresh
- [ ] Upload one MP3 file — same behaviour
- [ ] Upload multiple stems at once — all tracks appear without a page refresh
- [ ] Uploading a file over 100 MB shows an error message (no crash)
- [ ] Uploading a non-audio file (e.g. `.txt`) shows an error message
- [ ] Waveform renders for each track
- [ ] Play button starts playback; all stems play in sync
- [ ] Pause stops playback; position is remembered
- [ ] Mute/unmute a stem — audio mutes correctly
- [ ] Solo a stem — other stems go silent
- [ ] Volume slider changes the stem's volume
- [ ] Master volume slider changes overall level

---

## Comments

- [ ] Click "+ " in the comments tab to enter comment mode
- [ ] Click on the timeline ruler to place a comment at a timestamp
- [ ] Type a comment and save — it appears in the sidebar and on the timeline pin
- [ ] Click a comment card to jump the playhead to its timestamp
- [ ] Reply to a comment — reply appears in the thread view
- [ ] Resolve a comment — it moves to the "Resolved" filter
- [ ] Reopen a resolved comment — it moves back to "Open"

---

## Realtime

- [ ] Open the same project in two browser windows (logged in as the same or different user)
- [ ] Presence avatars show both users in the header
- [ ] Post a comment in one window — it appears in the other within a few seconds
- [ ] Save a version in one window — it appears in the Versions tab of the other
- [ ] Activity feed updates in both windows

---

## Versions

- [ ] "Save Version" button is visible for owner/editor
- [ ] Saving a version with a name creates it and shows it in the list
- [ ] Clicking a version shows its detail view
- [ ] "Restore this version" requires a confirmation step
- [ ] Confirming restore updates track mix settings and creates a safety backup version

---

## Sharing

- [ ] In the People tab, "Invite to workspace" form is visible for owner/editor
- [ ] Submit an invite for a viewer role — an invite link is shown
- [ ] Copy the link and open it in an incognito/different-account browser
- [ ] The invite accept page shows the correct project name and role
- [ ] Accepting the invite redirects to the project
- [ ] The invited viewer can see the project but cannot upload stems, comment, or manage settings
- [ ] In the People tab, "Share this project" section is visible for owner/editor
- [ ] Create a "View only" share link — the link is generated and can be copied
- [ ] Open the share link in an incognito browser — sign in and confirm the share access page shows the correct project name
- [ ] After accepting the share link, the user can view and play stems but cannot comment
- [ ] Create a "Can comment" share link — the share user can leave comments
- [ ] Revoking a share link shows the link as inactive (future visitors get "invalid" error)
- [ ] A share-link user cannot navigate to a different project by changing the URL

---

## Permissions

- [ ] Workspace viewer cannot see the upload widget
- [ ] Workspace viewer cannot leave comments (no compose button or form)
- [ ] Share-link viewer sees the People tab notice ("You have view-only access to this project")
- [ ] Share-link viewer does not see the invite form or share link controls
- [ ] Share-link commenter can comment but not upload or manage people

---

## Error states

- [ ] Visiting `/projects/<random-uuid>` as a non-member returns a 404 page (not a crash)
- [ ] Visiting `/share/<invalid-token>` shows "This share link is invalid or has been revoked"
- [ ] Visiting `/invite/<invalid-token>` shows "This invite link is invalid or does not exist"

---

## Health check

- [ ] `GET /api/health` returns `{ "status": "ok" }` — confirms the database connection is live

---

## Sign-off

| Section         | Checked by | Date |
| --------------- | ---------- | ---- |
| Auth            |            |      |
| Dashboard       |            |      |
| Upload/Playback |            |      |
| Comments        |            |      |
| Realtime        |            |      |
| Versions        |            |      |
| Sharing         |            |      |
| Permissions     |            |      |
| Error states    |            |      |
| Health check    |            |      |
