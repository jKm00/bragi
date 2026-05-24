import { authClient } from "./auth-client";
import { apiClient } from "./api-client";

type RealtimePresenceSnapshot = {
  userId: string;
  state: "playing" | "paused" | "offline" | "hidden" | "private";
  trackId: string | null;
  trackName: string | null;
  artistName: string | null;
  albumName: string | null;
  albumArtUrl: string | null;
  spotifyUrl: string | null;
  progressMs: number | null;
  durationMs: number | null;
  syncedAt: string;
};

type RoomPresenceUpdate = {
  roomId: string;
  snapshot: RealtimePresenceSnapshot;
};

type PlaybackSnapshot = {
  progressMs: number | null;
  durationMs: number | null;
  isPlaying: boolean;
};

type Listener = (message: RoomPresenceUpdate) => void;

let socket: WebSocket | null = null;
const listeners = new Set<Listener>();
let pollingTimeout: number | null = null;
let heartbeatInterval: number | null = null;
let isRunning = false;
let lastSnapshot: RealtimePresenceSnapshot | null = null;

const PAUSED_POLL_MS = 60_000;
const TRACK_END_BUFFER_MS = 2_000;
const HEARTBEAT_MS = 20_000;

function getWebSocketUrl() {
  const base = import.meta.env.VITE_BETTER_AUTH_URL ?? "http://127.0.0.1:3000";
  const url = new URL(base);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/api/v1/ws";
  return url.toString();
}

function emit(message: RoomPresenceUpdate) {
  listeners.forEach((listener) => listener(message));
}

function schedulePoll(delayMs: number) {
  if (pollingTimeout) {
    window.clearTimeout(pollingTimeout);
  }
  pollingTimeout = window.setTimeout(async () => {
    await pollSpotify();
  }, delayMs);
}

function calculateNextPoll(snapshot: RealtimePresenceSnapshot | null, playback: PlaybackSnapshot | null) {
  if (!snapshot || !playback || !playback.isPlaying) {
    return PAUSED_POLL_MS;
  }

  if (snapshot.durationMs == null || snapshot.progressMs == null) {
    return PAUSED_POLL_MS;
  }

  const remaining = snapshot.durationMs - snapshot.progressMs;
  if (!Number.isFinite(remaining) || remaining <= 0) {
    return TRACK_END_BUFFER_MS;
  }

  return Math.max(remaining + TRACK_END_BUFFER_MS, TRACK_END_BUFFER_MS);
}

function getPlaybackSnapshot(snapshot: RealtimePresenceSnapshot | null): PlaybackSnapshot | null {
  if (!snapshot) return null;
  return {
    progressMs: snapshot.progressMs,
    durationMs: snapshot.durationMs,
    isPlaying: snapshot.state === "playing",
  };
}

async function pollSpotify() {
  if (!isRunning) return;

  try {
    const res = await apiClient.api.v1.spotify.presence.$post();
    if (!res.ok) {
      schedulePoll(PAUSED_POLL_MS);
      return;
    }

    const data = (await res.json()) as { snapshot: RealtimePresenceSnapshot };
    lastSnapshot = data.snapshot;
    const playback = getPlaybackSnapshot(data.snapshot);
    schedulePoll(calculateNextPoll(data.snapshot, playback));
  } catch (error) {
    schedulePoll(PAUSED_POLL_MS);
  }
}

function startHeartbeat() {
  if (heartbeatInterval) {
    window.clearInterval(heartbeatInterval);
  }
  heartbeatInterval = window.setInterval(() => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(
      JSON.stringify({
        type: "presence:heartbeat",
        at: new Date().toISOString(),
      }),
    );
  }, HEARTBEAT_MS);
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    window.clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

function stopPolling() {
  if (pollingTimeout) {
    window.clearTimeout(pollingTimeout);
    pollingTimeout = null;
  }
}

export function resetPolling() {
  if (!isRunning) return;
  stopPolling();
  pollSpotify();
}

function closeSocket() {
  if (!socket) return;
  socket.close();
  socket = null;
}

export async function startRealtime() {
  if (isRunning) return;
  const session = await authClient.getSession();
  if (!session?.data?.session) return;

  isRunning = true;
  socket = new WebSocket(getWebSocketUrl());

  socket.addEventListener("message", (event) => {
    try {
      const payload = JSON.parse(String(event.data)) as RoomPresenceUpdate;
      if (payload?.roomId && payload?.snapshot) {
        emit(payload);
      }
    } catch (_error) {
      // ignore
    }
  });

  socket.addEventListener("open", () => {
    startHeartbeat();
  });

  socket.addEventListener("close", () => {
    stopHeartbeat();
  });

  pollSpotify();

  window.addEventListener("beforeunload", stopRealtime);
}

export function stopRealtime() {
  if (!isRunning) return;
  isRunning = false;
  stopPolling();
  stopHeartbeat();
  closeSocket();
  window.removeEventListener("beforeunload", stopRealtime);
}

export function subscribeToPresence(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getLastSnapshot() {
  return lastSnapshot;
}
