import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "./auth.js";

const port = Number(process.env.PORT ?? 3000);

// Init app
const app = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

// Configure cors
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
app.get("/api/v1/health", (c) => c.json({ ok: true }));

serve({
  fetch: app.fetch,
  port,
});

console.log(`api listening on http://localhost:${port}`);
