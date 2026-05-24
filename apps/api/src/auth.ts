import "dotenv/config";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db/client.js";
import * as schema from "./db/schema.js";
import { lastLoginMethod } from "better-auth/plugins";

const baseURL = process.env.BETTER_AUTH_URL ?? "http://127.0.0.1:3000";
const isLocalDev =
  baseURL.includes("localhost") || baseURL.includes("127.0.0.1");

export const auth = betterAuth({
  baseURL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  socialProviders: {
    spotify: {
      clientId: process.env.SPOTIFY_CLIENT_ID as string,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET as string,
      scope: ["user-read-playback-state", "user-read-currently-playing"],
    },
  },
  trustedOrigins: isLocalDev
    ? ["http://127.0.0.1:3000", "http://127.0.0.1:5173"]
    : ["bragi.api.edvardsen.dev", "bragi.edvardsen.dev"],
  account: {
    encryptOAuthTokens: true,
    updateAccountOnSignIn: true,
  },
  advanced: {
    crossSubDomainCookies: isLocalDev
      ? undefined
      : {
          enabled: true,
        },
  },
  plugins: [lastLoginMethod()],
});

export type TAuth = typeof auth.$Infer.Session;
