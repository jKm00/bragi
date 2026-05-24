import { createAdaptorServer } from "@hono/node-server";
import { and, eq, inArray, or } from "drizzle-orm";
import { Hono } from "hono";
import { createServer } from "http";
import { attachWebSocket } from "./ws-server.js";
import { auth } from "./auth.js";
import { db } from "./db/client.js";
import {
  presenceSnapshots,
  roomMemberships,
  rooms,
  user,
} from "./db/schema.js";
import { fanoutPresence } from "./realtime.js";
import { cors } from "hono/cors";

const port = Number(process.env.PORT ?? 3000);

// Init app
export const app = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

// Cors config
app.use(
  "/api/*",
  cors({
    origin:
      process.env.NODE_ENV === "development"
        ? ["http://127.0.0.1:5173", "http://127.0.0.1:4173"]
        : [],
    credentials: true,
  }),
);

// Auth middleware
app.use("*", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    c.set("user", null);
    c.set("session", null);
    await next();
    return;
  }

  c.set("user", session.user);
  c.set("session", session.session);
  await next();
});

// Auth handler
app.on(["POST", "GET"], "/api/auth/*", (c) => {
  return auth.handler(c.req.raw);
});

// Endpoints

const routes = app
  .get("/api/v1/health", (c) => c.json({ ok: true }))
  .post("/api/v1/spotify/presence", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });

    if (!session) return c.json({ message: "Unauthorized" }, 401);

    const spotifyResponse = await auth.api.getAccessToken({
      headers: c.req.raw.headers,
      body: { providerId: "spotify", userId: session.user.id },
    });

    if (!spotifyResponse) return c.json({ message: "Spotify not linked" }, 400);

    const playbackRes = await fetch("https://api.spotify.com/v1/me/player", {
      headers: {
        Authorization: `Bearer ${spotifyResponse.accessToken}`,
      },
    });

    if (playbackRes.status === 204) {
      const snapshot = {
        userId: session.user.id,
        state: "offline" as const,
        trackId: null,
        trackName: null,
        artistName: null,
        albumName: null,
        albumArtUrl: null,
        spotifyUrl: null,
        progressMs: null,
        durationMs: null,
        syncedAt: new Date().toISOString(),
      };

      await db
        .insert(presenceSnapshots)
        .values({
          userId: session.user.id,
          provider: "spotify",
          trackId: null,
          trackName: null,
          artistName: null,
          albumName: null,
          albumArtUrl: null,
          spotifyUrl: null,
          progressMs: null,
          durationMs: null,
          syncedAt: new Date(),
          state: "offline",
        })
        .onConflictDoUpdate({
          target: presenceSnapshots.userId,
          set: {
            trackId: null,
            trackName: null,
            artistName: null,
            albumName: null,
            albumArtUrl: null,
            spotifyUrl: null,
            progressMs: null,
            durationMs: null,
            syncedAt: new Date(),
            state: "offline",
          },
        });

      await fanoutPresence(session.user.id, snapshot);
      return c.json({ snapshot });
    }

    if (!playbackRes.ok) {
      return c.json(
        { message: "Failed to fetch Spotify playback" },
        playbackRes.status as 400 | 401 | 403 | 404 | 429 | 500,
      );
    }

    const playback = (await playbackRes.json()) as {
      is_playing: boolean;
      device?: { volume_percent?: number | null; is_muted?: boolean };
      progress_ms: number | null;
      item: {
        id: string | null;
        name: string | null;
        duration_ms: number | null;
        artists: Array<{ name: string }>;
        album: { name: string | null; images: Array<{ url: string }> };
        external_urls?: { spotify?: string };
      } | null;
    };

    const snapshot = {
      userId: session.user.id,
      state: playback.is_playing ? ("playing" as const) : ("paused" as const),
      trackId: playback.item?.id ?? null,
      trackName: playback.item?.name ?? null,
      artistName: playback.item?.artists?.[0]?.name ?? null,
      albumName: playback.item?.album?.name ?? null,
      albumArtUrl: playback.item?.album?.images?.[0]?.url ?? null,
      spotifyUrl: playback.item?.external_urls?.spotify ?? null,
      progressMs: playback.progress_ms ?? null,
      durationMs: playback.item?.duration_ms ?? null,
      syncedAt: new Date().toISOString(),
    };

    await db
      .insert(presenceSnapshots)
      .values({
        userId: session.user.id,
        provider: "spotify",
        trackId: snapshot.trackId,
        trackName: snapshot.trackName,
        artistName: snapshot.artistName,
        albumName: snapshot.albumName,
        albumArtUrl: snapshot.albumArtUrl,
        spotifyUrl: snapshot.spotifyUrl,
        progressMs: snapshot.progressMs,
        durationMs: snapshot.durationMs,
        syncedAt: new Date(snapshot.syncedAt),
        state: snapshot.state,
      })
      .onConflictDoUpdate({
        target: presenceSnapshots.userId,
        set: {
          trackId: snapshot.trackId,
          trackName: snapshot.trackName,
          artistName: snapshot.artistName,
          albumName: snapshot.albumName,
          albumArtUrl: snapshot.albumArtUrl,
          spotifyUrl: snapshot.spotifyUrl,
          progressMs: snapshot.progressMs,
          durationMs: snapshot.durationMs,
          syncedAt: new Date(snapshot.syncedAt),
          state: snapshot.state,
        },
      });

    await fanoutPresence(session.user.id, snapshot);

    return c.json({ snapshot });
  })
  .get("/api/v1/rooms", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });

    if (!session) return c.json({ rooms: [] }, 401);

    const rows = await db
      .select({
        id: rooms.id,
        name: rooms.name,
        inviteToken: rooms.inviteToken,
        ownerUserId: rooms.ownerUserId,
      })
      .from(rooms)
      .leftJoin(roomMemberships, eq(roomMemberships.roomId, rooms.id))
      .where(
        or(
          eq(rooms.ownerUserId, session.user.id),
          eq(roomMemberships.userId, session.user.id),
        ),
      );

    const uniqueRooms = Array.from(
      new Map(rows.map((room) => [room.id, room])).values(),
    ).map((room) => ({
      id: room.id,
      name: room.name,
      inviteToken:
        room.ownerUserId === session.user.id ? room.inviteToken : null,
      isOwner: room.ownerUserId === session.user.id,
    }));

    return c.json({ rooms: uniqueRooms });
  })
  .post("/api/v1/rooms", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });

    if (!session) return c.json({ message: "Unauthorized" }, 401);

    const body = (await c.req.json().catch(() => ({}))) as { name?: string };
    const inserted = await db
      .insert(rooms)
      .values({
        name: body.name?.trim() || null,
        ownerUserId: session.user.id,
        inviteToken: crypto.randomUUID(),
      })
      .returning({
        id: rooms.id,
        name: rooms.name,
        inviteToken: rooms.inviteToken,
      });

    await db.insert(roomMemberships).values({
      roomId: inserted[0].id,
      userId: session.user.id,
      role: "owner",
      status: "active",
    });

    return c.json(inserted[0], 201);
  })
  .post("/api/v1/rooms/join", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });

    if (!session) return c.json({ message: "Unauthorized" }, 401);

    const body = (await c.req.json().catch(() => ({}))) as {
      inviteToken?: string;
    };

    if (!body.inviteToken) {
      return c.json({ message: "inviteToken is required" }, 400);
    }

    const room = await db
      .select({
        id: rooms.id,
        ownerUserId: rooms.ownerUserId,
        name: rooms.name,
        inviteToken: rooms.inviteToken,
        createdAt: rooms.createdAt,
        updatedAt: rooms.updatedAt,
      })
      .from(rooms)
      .where(eq(rooms.inviteToken, body.inviteToken))
      .limit(1)
      .then((rows) => rows[0]);

    if (!room) {
      return c.json({ message: "Invalid invite link" }, 404);
    }

    if (room.ownerUserId === session.user.id) {
      return c.json({ room });
    }

    await db
      .delete(roomMemberships)
      .where(
        and(
          eq(roomMemberships.roomId, room.id),
          eq(roomMemberships.userId, session.user.id),
        ),
      );

    await db
      .insert(roomMemberships)
      .values({
        roomId: room.id,
        userId: session.user.id,
        role: "member",
        status: "active",
      })
      .onConflictDoNothing();

    return c.json({ room });
  })
  .get("/api/v1/rooms/:roomId", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });

    if (!session)
      return c.json({ accessible: false, message: "Unauthorized" }, 401);

    const roomId = c.req.param("roomId");
    const room = await db
      .select({
        id: rooms.id,
        ownerUserId: rooms.ownerUserId,
        name: rooms.name,
        inviteToken: rooms.inviteToken,
        createdAt: rooms.createdAt,
        updatedAt: rooms.updatedAt,
      })
      .from(rooms)
      .where(eq(rooms.id, roomId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!room)
      return c.json({ accessible: false, message: "Room not found" }, 404);

    const membership = await db
      .select({ id: roomMemberships.id, role: roomMemberships.role })
      .from(roomMemberships)
      .where(
        and(
          eq(roomMemberships.roomId, room.id),
          eq(roomMemberships.userId, session.user.id),
          eq(roomMemberships.status, "active"),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]);

    if (room.ownerUserId !== session.user.id && !membership) {
      return c.json(
        {
          accessible: false,
          message:
            "Make sure the room link is correct, or ask the owner for an invite link.",
        },
        403,
      );
    }

    return c.json({
      accessible: true,
      room: {
        id: room.id,
        name: room.name,
        isOwner: room.ownerUserId === session.user.id,
        role:
          membership?.role ??
          (room.ownerUserId === session.user.id ? "owner" : "member"),
        inviteToken:
          room.ownerUserId === session.user.id ? room.inviteToken : null,
      },
    });
  })
  .get("/api/v1/rooms/:roomId/members", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });

    if (!session) return c.json({ message: "Unauthorized" }, 401);

    const roomId = c.req.param("roomId");
    const room = await db
      .select({ id: rooms.id, ownerUserId: rooms.ownerUserId })
      .from(rooms)
      .where(eq(rooms.id, roomId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!room) return c.json({ message: "Room not found" }, 404);

    const membership = await db
      .select({ id: roomMemberships.id })
      .from(roomMemberships)
      .where(
        and(
          eq(roomMemberships.roomId, room.id),
          eq(roomMemberships.userId, session.user.id),
          eq(roomMemberships.status, "active"),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]);

    if (room.ownerUserId !== session.user.id && !membership) {
      return c.json({ message: "Forbidden" }, 403);
    }

    const rows = await db
      .select({
        userId: user.id,
        name: user.name,
        image: user.image,
        role: roomMemberships.role,
        status: roomMemberships.status,
      })
      .from(roomMemberships)
      .innerJoin(user, eq(user.id, roomMemberships.userId))
      .where(
        and(
          eq(roomMemberships.roomId, room.id),
          eq(roomMemberships.status, "active"),
        ),
      );

    const members = [
      {
        userId: room.ownerUserId,
        name: room.ownerUserId === session.user.id ? "You" : "Owner",
        image: null,
        role: "owner" as const,
        status: "active" as const,
      },
      ...rows.filter((member) => member.userId !== room.ownerUserId),
    ];

    return c.json({ members });
  })
  .get("/api/v1/rooms/:roomId/presence", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });

    if (!session) return c.json({ message: "Unauthorized" }, 401);

    const roomId = c.req.param("roomId");
    const room = await db
      .select({ id: rooms.id, ownerUserId: rooms.ownerUserId })
      .from(rooms)
      .where(eq(rooms.id, roomId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!room) return c.json({ message: "Room not found" }, 404);

    const membership = await db
      .select({ id: roomMemberships.id })
      .from(roomMemberships)
      .where(
        and(
          eq(roomMemberships.roomId, room.id),
          eq(roomMemberships.userId, session.user.id),
          eq(roomMemberships.status, "active"),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]);

    if (room.ownerUserId !== session.user.id && !membership) {
      return c.json({ message: "Forbidden" }, 403);
    }

    const memberIds = await db
      .select({ userId: roomMemberships.userId })
      .from(roomMemberships)
      .where(
        and(
          eq(roomMemberships.roomId, room.id),
          eq(roomMemberships.status, "active"),
        ),
      )
      .then((rows) => rows.map((row) => row.userId));

    const uniqueMemberIds = Array.from(
      new Set([...memberIds, room.ownerUserId]),
    );

    const snapshots = await db
      .select({
        userId: presenceSnapshots.userId,
        trackId: presenceSnapshots.trackId,
        trackName: presenceSnapshots.trackName,
        artistName: presenceSnapshots.artistName,
        albumName: presenceSnapshots.albumName,
        albumArtUrl: presenceSnapshots.albumArtUrl,
        spotifyUrl: presenceSnapshots.spotifyUrl,
        progressMs: presenceSnapshots.progressMs,
        durationMs: presenceSnapshots.durationMs,
        syncedAt: presenceSnapshots.syncedAt,
        state: presenceSnapshots.state,
      })
      .from(presenceSnapshots)
      .where(inArray(presenceSnapshots.userId, uniqueMemberIds));

    return c.json({ snapshots });
  })
  .post("/api/v1/rooms/:roomId/leave", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });

    if (!session) return c.json({ message: "Unauthorized" }, 401);

    const roomId = c.req.param("roomId");
    const room = await db
      .select({ id: rooms.id, ownerUserId: rooms.ownerUserId })
      .from(rooms)
      .where(eq(rooms.id, roomId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!room) return c.json({ message: "Room not found" }, 404);

    if (room.ownerUserId === session.user.id) {
      return c.json(
        { message: "Owner must transfer ownership or delete the room" },
        400,
      );
    }

    await db
      .update(roomMemberships)
      .set({ status: "left", updatedAt: new Date() })
      .where(
        and(
          eq(roomMemberships.roomId, room.id),
          eq(roomMemberships.userId, session.user.id),
          eq(roomMemberships.status, "active"),
        ),
      );

    return c.json({ ok: true });
  })
  .post("/api/v1/rooms/:roomId/delete", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });

    if (!session) return c.json({ message: "Unauthorized" }, 401);

    const roomId = c.req.param("roomId");
    const room = await db
      .select({ id: rooms.id, ownerUserId: rooms.ownerUserId })
      .from(rooms)
      .where(eq(rooms.id, roomId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!room) return c.json({ message: "Room not found" }, 404);

    if (room.ownerUserId !== session.user.id) {
      return c.json({ message: "Forbidden" }, 403);
    }

    await db.delete(rooms).where(eq(rooms.id, room.id));

    return c.json({ ok: true });
  })
  .post("/api/v1/rooms/:roomId/transfer/:userId", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });

    if (!session) return c.json({ message: "Unauthorized" }, 401);

    const roomId = c.req.param("roomId");
    const userId = c.req.param("userId");

    const room = await db
      .select({ id: rooms.id, ownerUserId: rooms.ownerUserId })
      .from(rooms)
      .where(eq(rooms.id, roomId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!room) return c.json({ message: "Room not found" }, 404);

    if (room.ownerUserId !== session.user.id) {
      return c.json({ message: "Forbidden" }, 403);
    }

    const targetMembership = await db
      .select({ id: roomMemberships.id })
      .from(roomMemberships)
      .where(
        and(
          eq(roomMemberships.roomId, room.id),
          eq(roomMemberships.userId, userId),
          eq(roomMemberships.status, "active"),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]);

    if (!targetMembership) {
      return c.json({ message: "Member not found" }, 404);
    }

    await db.transaction(async (tx) => {
      await tx
        .update(rooms)
        .set({ ownerUserId: userId, updatedAt: new Date() })
        .where(eq(rooms.id, room.id));

      await tx
        .update(roomMemberships)
        .set({ role: "owner", updatedAt: new Date() })
        .where(eq(roomMemberships.id, targetMembership.id));

      await tx
        .update(roomMemberships)
        .set({ role: "member", updatedAt: new Date() })
        .where(
          and(
            eq(roomMemberships.roomId, room.id),
            eq(roomMemberships.userId, room.ownerUserId),
            eq(roomMemberships.status, "active"),
          ),
        );
    });

    return c.json({ ok: true });
  });

export type ApiType = typeof routes;

const server = createAdaptorServer({
  fetch: app.fetch,
  port,
  createServer,
});

attachWebSocket(server as ReturnType<typeof createServer>);

server.listen(port);

console.log(`api listening on http://localhost:${port}`);
