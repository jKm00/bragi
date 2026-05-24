# Bragi Implementation Architecture

## Stack
- Backend: Hono on Node.js
- Auth: Better Auth with Spotify provider
- Database: Postgres
- Realtime: WebSockets
- Frontend: React + Vite + TanStack Router
- Hosting: Railway
- Repo layout: monorepo

## High-Level Shape
1. Frontend authenticates through Better Auth.
2. The browser keeps the Spotify session for the active tab and polls Spotify while the app is open.
3. The browser syncs meaningful presence updates and a lightweight heartbeat to the backend over WebSockets.
4. Backend stores app user, room membership, invite state, and the latest presence snapshots in Postgres.
5. A tiny cleanup job expires stale presence when the client stops heartbeating.
6. Frontend renders room state from the backend and receives live updates over WebSockets.

## Backend Modules
- `auth`: Better Auth integration and session handling.
- `rooms`: create room, join room, rotate invite, kick member, transfer ownership, delete room.
- `memberships`: join/leave and per-room visibility settings.
- `presence`: snapshot storage, expiry, stale cleanup, and room broadcast logic.
- `realtime`: websocket connection management and room fanout.
- `sync`: acceptance and validation of browser presence payloads.

## API Style
- Use Hono RPC routes for typed client/server contracts.
- Keep domain types shared between frontend and backend.

## Realtime Flow
1. User connects to a room over WebSocket.
2. Backend subscribes that socket to the room channel.
3. Browser polls Spotify while the tab is open.
4. Browser sends changed presence and heartbeat events to the backend.
5. Backend persists the latest snapshot and broadcasts the updated active list to room subscribers.

## Polling Strategy
- Use a browser-side adaptive scheduler.
- Poll `Get Playback State` while the app is open.
- Track playback timestamp and duration to estimate the next useful poll.
- Send only meaningful presence changes to the backend.
- Send a lightweight heartbeat to prove the tab is still open.
- Stop polling when the tab closes or the user leaves the room.
- Use a short timeout before removing stale presence.

## Auth Flow
1. User signs in with Spotify.
2. Better Auth creates or resolves the app user.
3. Spotify account is linked one-to-one with the app user.
4. Keep the browser session responsible for the Spotify polling loop in the POC.

## Room Rules
- Invite-only rooms.
- Reusable invite until owner rotates it.
- Immediate revoke on rotation.
- One owner per room.
- Owner cannot leave directly.
- Owner must transfer ownership or delete the room.

## Client Layout
- Desktop: split view with active listeners larger than members.
- Mobile: tabs for active and members.
- Settings in a dialog.

## Risks
- Spotify rate limits if the polling cadence is too aggressive.
- Browser tab close ends presence immediately after timeout.
- Browser session token handling is less secure than a server-owned flow.
- Private session and hidden state ambiguity.

## Mitigations
- Adaptive browser polling cadence.
- Short-lived active presence cache.
- WebSocket heartbeat and stale timeout.
- Clear empty/stale states in UI.
- Minimal OAuth scopes.
