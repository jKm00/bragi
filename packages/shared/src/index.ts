export type VisibilityMode = 'visible' | 'hidden' | 'anonymous';

export type PresenceState = 'playing' | 'paused' | 'offline' | 'hidden' | 'private';

export type RoomMemberRole = 'owner' | 'member';

export type RoomMemberStatus = 'active' | 'kicked' | 'left';

export interface RoomSummary {
  id: string;
  name: string | null;
  ownerUserId: string;
}

export interface PresenceSnapshot {
  userId: string;
  state: PresenceState;
  trackName: string | null;
  artistName: string | null;
  spotifyUrl: string | null;
  lastPolledAt: string;
  expiresAt: string;
}
