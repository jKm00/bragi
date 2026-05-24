# Bragi Database Schema

## Core Entities

### users
- `id` uuid pk
- `email` text unique nullable
- `name` text nullable
- `avatar_url` text nullable
- `created_at` timestamptz
- `updated_at` timestamptz

### auth_accounts
- `id` uuid pk
- `user_id` uuid fk -> users.id
- `provider` text
- `provider_account_id` text
- `access_token` text nullable encrypted
- `refresh_token` text nullable encrypted
- `access_token_expires_at` timestamptz nullable
- `refresh_token_expires_at` timestamptz nullable
- `created_at` timestamptz
- unique(`provider`, `provider_account_id`)

### rooms
- `id` uuid pk
- `owner_user_id` uuid fk -> users.id
- `name` text nullable
- `invite_token` text unique
- `invite_rotated_at` timestamptz nullable
- `created_at` timestamptz
- `updated_at` timestamptz

### room_memberships
- `id` uuid pk
- `room_id` uuid fk -> rooms.id
- `user_id` uuid fk -> users.id
- `role` text (`owner`, `member`)
- `status` text (`active`, `kicked`, `left`)
- `created_at` timestamptz
- `updated_at` timestamptz
- unique(`room_id`, `user_id`)

### room_member_settings
- `id` uuid pk
- `room_id` uuid fk -> rooms.id
- `user_id` uuid fk -> users.id
- `visibility_mode` text (`visible`, `hidden`, `anonymous`)
- `updated_at` timestamptz
- unique(`room_id`, `user_id`)

### spotify_profiles
- `id` uuid pk
- `user_id` uuid fk -> users.id unique
- `spotify_user_id` text unique
- `display_name` text nullable
- `profile_image_url` text nullable
- `linked_at` timestamptz

### presence_snapshots
- `id` uuid pk
- `user_id` uuid fk -> users.id unique
- `provider` text
- `client_session_id` text nullable
- `provider_track_id` text nullable
- `track_name` text nullable
- `artist_name` text nullable
- `album_name` text nullable
- `album_art_url` text nullable
- `spotify_url` text nullable
- `started_at` timestamptz nullable
- `track_duration_ms` integer nullable
- `last_polled_at` timestamptz
- `last_heartbeat_at` timestamptz nullable
- `last_synced_at` timestamptz nullable
- `expires_at` timestamptz
- `state` text (`playing`, `paused`, `offline`, `hidden`, `private`)

### room_invite_events
- `id` uuid pk
- `room_id` uuid fk -> rooms.id
- `rotated_by_user_id` uuid fk -> users.id
- `old_token_hash` text
- `new_token_hash` text
- `created_at` timestamptz

## Notes
- Keep room membership and per-room settings separate.
- Delete room metadata and membership/settings rows when a room is deleted.
- Keep only the latest presence snapshot for each user.
- The API owns Spotify token access and refresh.
- The browser never stores Spotify access or refresh tokens.
- The backend only stores the latest synced presence state and heartbeat timestamps.
