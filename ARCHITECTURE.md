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
2. Frontend sends Spotify actions to the API, and the API proxies Spotify requests using server-side access tokens.
3. The browser syncs meaningful presence updates and a lightweight heartbeat to the backend over WebSockets.
4. Backend stores app user, room membership, invite state, Spotify account tokens, and the latest presence snapshots in Postgres.
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
3. Browser requests Spotify state through the API.
4. API fetches or refreshes the Spotify access token server-side, calls Spotify, then returns the result to the browser.
5. Browser sends changed presence and heartbeat events to the backend.
6. Backend persists the latest snapshot and broadcasts the updated active list to room subscribers.

## Polling Strategy
- Use a browser-side scheduler only for app state changes.
- Request Spotify playback state from the API.
- API owns Spotify access token retrieval and refresh.
- Send only meaningful presence changes to the backend.
- Send a lightweight heartbeat to prove the tab is still open.
- Stop polling when the tab closes or the user leaves the room.
- Use a short timeout before removing stale presence.

## Auth Flow
1. User signs in with Spotify.
2. Better Auth creates or resolves the app user.
3. Spotify account is linked one-to-one with the app user.
4. Better Auth stores encrypted Spotify account tokens server-side.
5. The API fetches Spotify access tokens on demand and refreshes them when needed.

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
- Exposing Spotify tokens to the browser would be unnecessary and risky.
- Private session and hidden state ambiguity.

## Mitigations
- Adaptive request cadence.
- Short-lived active presence cache.
- WebSocket heartbeat and stale timeout.
- Clear empty/stale states in UI.
- Minimal OAuth scopes.
- Keep Spotify token access server-side only.
