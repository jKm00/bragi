CREATE TYPE "presence_state" AS ENUM('playing', 'paused', 'offline', 'hidden', 'private');--> statement-breakpoint
CREATE TYPE "room_member_role" AS ENUM('owner', 'member');--> statement-breakpoint
CREATE TYPE "room_member_status" AS ENUM('active', 'kicked', 'left');--> statement-breakpoint
CREATE TYPE "user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "visibility_mode" AS ENUM('visible', 'hidden', 'anonymous');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp(6) with time zone,
	"refresh_token_expires_at" timestamp(6) with time zone,
	"scope" text,
	"id_token" text,
	"password" text,
	"created_at" timestamp(6) with time zone NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "presence_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" text NOT NULL UNIQUE,
	"provider" text NOT NULL,
	"track_id" text,
	"track_name" text,
	"artist_name" text,
	"album_name" text,
	"album_art_url" text,
	"spotify_url" text,
	"progress_ms" integer,
	"duration_ms" integer,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"state" "presence_state" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_member_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"room_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"visibility_mode" "visibility_mode" DEFAULT 'visible'::"visibility_mode" NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"room_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "room_member_role" DEFAULT 'member'::"room_member_role" NOT NULL,
	"status" "room_member_status" DEFAULT 'active'::"room_member_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"owner_user_id" text NOT NULL,
	"name" text,
	"invite_token" text NOT NULL UNIQUE,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"token" varchar(255) NOT NULL UNIQUE,
	"expires_at" timestamp(6) with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp(6) with time zone NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"email" varchar(255) NOT NULL UNIQUE,
	"email_verified" boolean NOT NULL,
	"image" text,
	"created_at" timestamp(6) with time zone NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp(6) with time zone NOT NULL,
	"created_at" timestamp(6) with time zone NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "presence_snapshots" ADD CONSTRAINT "presence_snapshots_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "room_member_settings" ADD CONSTRAINT "room_member_settings_room_id_rooms_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "room_member_settings" ADD CONSTRAINT "room_member_settings_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "room_memberships" ADD CONSTRAINT "room_memberships_room_id_rooms_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "room_memberships" ADD CONSTRAINT "room_memberships_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_owner_user_id_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;