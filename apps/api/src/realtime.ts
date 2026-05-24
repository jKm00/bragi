import { and, eq, inArray } from "drizzle-orm";
import type { WebSocket } from "ws";
import { db } from "./db/client.js";
import { roomMemberships, rooms } from "./db/schema.js";

export type PresenceSnapshot = {
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

type PresenceMessage = {
  type: "presence:update";
  snapshot: PresenceSnapshot;
};

type HeartbeatMessage = {
  type: "presence:heartbeat";
  at: string;
};

type ClientMessage = PresenceMessage | HeartbeatMessage;

type RoomSnapshot = {
  roomId: string;
  snapshot: PresenceSnapshot;
};

const socketsByUserId = new Map<string, Set<WebSocket>>();
const socketsByRoomId = new Map<string, Set<WebSocket>>();
const socketRooms = new Map<WebSocket, Set<string>>();

const lastSnapshots = new Map<string, PresenceSnapshot>();
const lastHeartbeats = new Map<string, number>();

const PRESENCE_TTL_MS = 45_000;

function addSocketForUser(userId: string, socket: WebSocket) {
  const set = socketsByUserId.get(userId) ?? new Set<WebSocket>();
  set.add(socket);
  socketsByUserId.set(userId, set);
}

function removeSocketForUser(userId: string, socket: WebSocket) {
  const set = socketsByUserId.get(userId);
  if (!set) return;
  set.delete(socket);
  if (!set.size) socketsByUserId.delete(userId);
}

function addSocketToRoom(roomId: string, socket: WebSocket) {
  const set = socketsByRoomId.get(roomId) ?? new Set<WebSocket>();
  set.add(socket);
  socketsByRoomId.set(roomId, set);

  const rooms = socketRooms.get(socket) ?? new Set<string>();
  rooms.add(roomId);
  socketRooms.set(socket, rooms);
}

function syncSocketRooms(userId: string, roomIds: string[]) {
  const sockets = socketsByUserId.get(userId);
  if (!sockets) return;

  sockets.forEach((socket) => {
    const existingRooms = socketRooms.get(socket);
    if (existingRooms) {
      Array.from(existingRooms).forEach((roomId) =>
        removeSocketFromRoom(roomId, socket),
      );
    }
    roomIds.forEach((roomId) => addSocketToRoom(roomId, socket));
  });
}

function removeSocketFromRoom(roomId: string, socket: WebSocket) {
  const set = socketsByRoomId.get(roomId);
  if (!set) return;
  set.delete(socket);
  if (!set.size) socketsByRoomId.delete(roomId);

  const rooms = socketRooms.get(socket);
  if (!rooms) return;
  rooms.delete(roomId);
  if (!rooms.size) socketRooms.delete(socket);
}

async function getUserRoomIds(userId: string) {
  const membershipRows = await db
    .select({ roomId: roomMemberships.roomId })
    .from(roomMemberships)
    .where(
      and(
        eq(roomMemberships.userId, userId),
        eq(roomMemberships.status, "active"),
      ),
    );

  const roomRows = await db
    .select({ roomId: rooms.id })
    .from(rooms)
    .where(eq(rooms.ownerUserId, userId));

  return Array.from(new Set([
    ...membershipRows.map((row) => row.roomId),
    ...roomRows.map((row) => row.roomId),
  ]));
}

async function getRoomMemberUserIds(roomIds: string[]) {
  if (!roomIds.length) return [] as string[];

  const membershipRows = await db
    .select({ userId: roomMemberships.userId })
    .from(roomMemberships)
    .where(
      and(
        inArray(roomMemberships.roomId, roomIds),
        eq(roomMemberships.status, "active"),
      ),
    );

  const ownerRows = await db
    .select({ userId: rooms.ownerUserId })
    .from(rooms)
    .where(inArray(rooms.id, roomIds));

  return Array.from(new Set([
    ...membershipRows.map((row) => row.userId),
    ...ownerRows.map((row) => row.userId),
  ]));
}

function broadcastToRooms(message: RoomSnapshot, roomIds: string[]) {
  const payload = JSON.stringify(message);
  roomIds.forEach((roomId) => {
    const sockets = socketsByRoomId.get(roomId);
    if (!sockets) return;
    sockets.forEach((socket) => {
      if (socket.readyState === socket.OPEN) {
        socket.send(payload);
      }
    });
  });
}

export async function registerSocket(userId: string, socket: WebSocket) {
  addSocketForUser(userId, socket);
  const roomIds = await getUserRoomIds(userId);
  roomIds.forEach((roomId) => addSocketToRoom(roomId, socket));

  const snapshots: RoomSnapshot[] = [];
  roomIds.forEach((roomId) => {
    lastSnapshots.forEach((snapshot, key) => {
      if (!key.startsWith(`${roomId}:`)) return;
      snapshots.push({ roomId, snapshot });
    });
  });

  snapshots.forEach((snapshot) => {
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify(snapshot));
    }
  });
}

export function unregisterSocket(userId: string, socket: WebSocket) {
  removeSocketForUser(userId, socket);
  const existingRooms = socketRooms.get(socket);
  if (existingRooms) {
    Array.from(existingRooms).forEach((roomId) =>
      removeSocketFromRoom(roomId, socket),
    );
  }
}

export async function handleClientMessage(userId: string, message: ClientMessage) {
  if (message.type === "presence:heartbeat") {
    lastHeartbeats.set(userId, Date.now());
    return;
  }

  if (message.type === "presence:update") {
    const snapshot = message.snapshot;
    const roomIds = await getUserRoomIds(userId);
    if (!roomIds.length) return;

    syncSocketRooms(userId, roomIds);

    roomIds.forEach((roomId) => {
      lastSnapshots.set(`${roomId}:${userId}`, snapshot);
    });

    roomIds.forEach((roomId) => {
      broadcastToRooms({ roomId, snapshot }, [roomId]);
    });
  }
}

export function initializeHeartbeat(userId: string) {
  lastHeartbeats.set(userId, Date.now());
}

export async function fanoutPresence(userId: string, snapshot: PresenceSnapshot) {
  const roomIds = await getUserRoomIds(userId);
  if (!roomIds.length) return;

  syncSocketRooms(userId, roomIds);

  roomIds.forEach((roomId) => {
    lastSnapshots.set(`${roomId}:${userId}`, snapshot);
  });

  roomIds.forEach((roomId) => {
    broadcastToRooms({ roomId, snapshot }, [roomId]);
  });
}

export function getRelevantUserIds(roomIds: string[]) {
  return getRoomMemberUserIds(roomIds);
}

export function cleanupStalePresence(onExpire: (roomId: string, userId: string) => void) {
  const now = Date.now();
  lastHeartbeats.forEach((lastHeartbeat, userId) => {
    if (now - lastHeartbeat < PRESENCE_TTL_MS) return;
    lastHeartbeats.delete(userId);
    socketsByRoomId.forEach((_sockets, roomId) => {
      const key = `${roomId}:${userId}`;
      if (!lastSnapshots.has(key)) return;
      lastSnapshots.delete(key);
      onExpire(roomId, userId);
    });
  });
}
