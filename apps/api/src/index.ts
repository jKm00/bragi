import { serve } from "@hono/node-server";
import { eq, or } from "drizzle-orm";
import { Hono } from "hono";
import { auth } from "./auth.js";
import { db } from "./db/client.js";
import { roomMemberships, rooms } from "./db/schema.js";
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
  "*",
  cors({
    origin: ["http://127.0.0.1:5173"],
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
  .get("/api/v1/rooms", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });

    if (!session) return c.json({ rooms: [] }, 401);

    const rows = await db
      .select({
        id: rooms.id,
        name: rooms.name,
        inviteToken: rooms.inviteToken,
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
    );

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
      .select({ id: roomMemberships.id })
      .from(roomMemberships)
      .where(
        or(
          eq(roomMemberships.roomId, room.id),
          eq(roomMemberships.userId, session.user.id),
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
      },
    });
  });

export type ApiType = typeof routes;

serve({
  fetch: app.fetch,
  port,
});

console.log(`api listening on http://localhost:${port}`);
