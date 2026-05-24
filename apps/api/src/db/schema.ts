import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const roomMemberRoleEnum = pgEnum("room_member_role", [
  "owner",
  "member",
]);
export const roomMemberStatusEnum = pgEnum("room_member_status", [
  "active",
  "kicked",
  "left",
]);
export const visibilityModeEnum = pgEnum("visibility_mode", [
  "visible",
  "hidden",
  "anonymous",
]);
export const presenceStateEnum = pgEnum("presence_state", [
  "playing",
  "paused",
  "offline",
  "hidden",
  "private",
]);

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text("image"),
  createdAt: timestamp("created_at", {
    precision: 6,
    withTimezone: true,
  }).notNull(),
  updatedAt: timestamp("updated_at", {
    precision: 6,
    withTimezone: true,
  }).notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at", {
    precision: 6,
    withTimezone: true,
  }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", {
    precision: 6,
    withTimezone: true,
  }).notNull(),
  updatedAt: timestamp("updated_at", {
    precision: 6,
    withTimezone: true,
  }).notNull(),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", {
    precision: 6,
    withTimezone: true,
  }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
    precision: 6,
    withTimezone: true,
  }),
  scope: text("scope"),
  idToken: text("id_token"),
  password: text("password"),
  createdAt: timestamp("created_at", {
    precision: 6,
    withTimezone: true,
  }).notNull(),
  updatedAt: timestamp("updated_at", {
    precision: 6,
    withTimezone: true,
  }).notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", {
    precision: 6,
    withTimezone: true,
  }).notNull(),
  createdAt: timestamp("created_at", {
    precision: 6,
    withTimezone: true,
  }).notNull(),
  updatedAt: timestamp("updated_at", {
    precision: 6,
    withTimezone: true,
  }).notNull(),
});

export const rooms = pgTable("rooms", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerUserId: text("owner_user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name"),
  inviteToken: text("invite_token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const roomMemberships = pgTable("room_memberships", {
  id: uuid("id").defaultRandom().primaryKey(),
  roomId: uuid("room_id")
    .notNull()
    .references(() => rooms.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  role: roomMemberRoleEnum("role").notNull().default("member"),
  status: roomMemberStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const roomMemberSettings = pgTable("room_member_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  roomId: uuid("room_id")
    .notNull()
    .references(() => rooms.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  visibilityMode: visibilityModeEnum("visibility_mode")
    .notNull()
    .default("visible"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const presenceSnapshots = pgTable("presence_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" })
    .unique(),
  provider: text("provider").notNull(),
  trackId: text("track_id"),
  trackName: text("track_name"),
  artistName: text("artist_name"),
  albumName: text("album_name"),
  albumArtUrl: text("album_art_url"),
  spotifyUrl: text("spotify_url"),
  progressMs: integer("progress_ms"),
  durationMs: integer("duration_ms"),
  isMuted: boolean("is_muted").notNull().default(false),
  syncedAt: timestamp("synced_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  state: presenceStateEnum("state").notNull(),
});
