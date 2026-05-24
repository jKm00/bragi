# Bragi Details Plan

## Phase 1: Foundation
- [ ] Initialize Hono backend project structure.
- [ ] Initialize React + Vite + TanStack Router frontend.
- [ ] Configure monorepo layout.
- [ ] Set up Postgres connection and migrations.
- [ ] Add shared types package for frontend/backend contracts.
- [ ] Document the app-open-only POC presence model.

## Phase 2: Auth
- [ ] Integrate Better Auth.
- [ ] Configure Spotify OAuth login.
- [ ] Create app user automatically on first Spotify sign-in.
- [ ] Store Spotify tokens server-side and proxy Spotify requests through the API.

## Phase 3: Rooms
- [ ] Create room model and owner relationship.
- [ ] Implement invite token creation.
- [ ] Implement invite rotation with immediate invalidation.
- [ ] Implement join-by-invite flow.
- [ ] Implement room switcher.

## Phase 4: Membership and Moderation
- [ ] Implement room membership list.
- [ ] Implement kick user action.
- [ ] Implement ownership transfer.
- [ ] Implement room deletion.
- [ ] Delete room memberships and settings when a room is deleted.

## Phase 5: Presence
- [ ] Implement API proxy for Spotify playback polling.
- [ ] Poll `Get Playback State` through the API while the app is open.
- [ ] Add adaptive poll cadence based on progress and track length.
- [ ] Sync meaningful presence changes to the backend over WebSockets.
- [ ] Add lightweight heartbeat while the app is open.
- [ ] Persist latest presence snapshot only.
- [ ] Add stale presence timeout cleanup.
- [ ] Remove users from active lists after the timeout expires.

## Phase 6: Privacy Settings
- [ ] Implement hidden mode per room.
- [ ] Implement anonymous mode per room.
- [ ] Make hidden and anonymous mutually exclusive.
- [ ] Reset room privacy settings on leave.

## Phase 7: UI
- [ ] Build room page desktop split view.
- [ ] Build room page mobile tabs.
- [ ] Build active listener cards.
- [ ] Build member list.
- [ ] Build owner settings dialog.
- [ ] Build empty state for rooms with no active listeners.

## Phase 8: Polish
- [ ] Add loading and error states.
- [ ] Add basic Spotify rate-limit/backoff handling in the API proxy.
- [ ] Add room lifecycle edge-case handling.
- [ ] Verify Spotify link/open behavior.

## Done Criteria
- [ ] A user can sign in with Spotify and enter a room.
- [ ] A room shows live active listeners while users keep the app open.
- [ ] Owner controls work.
- [ ] Hidden and anonymous settings work per room.
