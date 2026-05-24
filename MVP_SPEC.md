# Bragi MVP Spec

## Goal
Build a web app that shows what coworkers in a room are listening to on Spotify while the app is open.

## MVP Scope
- Spotify login creates the app account on first sign-in.
- Users can create a room and become the owner.
- Owner can generate and rotate an invite link.
- Users can join multiple rooms.
- Room page shows:
  - active listeners
  - all room members
  - owner controls in a dialog
- Presence updates are client-driven and only work while the web app is open.
- The browser asks the API to poll Spotify, and the API proxies Spotify requests using server-side OAuth tokens.
- Users disappear from the active list shortly after closing the tab or stopping heartbeat.
- Users can toggle per-room hidden mode or anonymous mode.
- Hidden and anonymous modes are mutually exclusive.
- Owner can kick members.
- Owner can transfer ownership.
- Owner can delete the room.
- Clicking a song opens it in Spotify.

## Out of Scope for MVP
- Playlist add action.
- Song preview playback in-app.
- Podcast support.
- Multi-provider login beyond Spotify.
- Public room discovery.
- Notifications.
- Social features like DMs, reactions, follows.

## Main User Flows
1. Sign in with Spotify.
2. Create room or join via invite.
3. Open the web app to appear in the active list.
4. On join, choose anonymous mode or not.
5. View active listeners and room members.
6. Toggle hidden or anonymous mode from the room UI.
7. Owner rotates invite, kicks users, transfers ownership, or deletes room.

## Success Criteria
- A user can open the app and immediately see which coworkers are listening.
- Presence updates remain fresh while the app is open.
- Room access stays controlled by invite only.
- Owner moderation actions work reliably.
