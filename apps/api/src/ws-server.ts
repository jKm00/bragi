import type { IncomingMessage, Server } from "http";
import type { WebSocket } from "ws";
import { WebSocketServer } from "ws";
import { auth } from "./auth.js";
import {
  handleClientMessage,
  initializeHeartbeat,
  registerSocket,
  unregisterSocket,
} from "./realtime.js";

const wss = new WebSocketServer({ noServer: true });

function sendError(socket: WebSocket, message: string) {
  if (socket.readyState !== socket.OPEN) return;
  socket.send(JSON.stringify({ type: "error", message }));
}

export function attachWebSocket(server: Server) {
  server.on("upgrade", async (req: IncomingMessage, socket, head) => {
    if (!req.url?.startsWith("/api/v1/ws")) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", async (socket, req) => {
    const session = await auth.api.getSession({
      headers: new Headers(req.headers as Record<string, string>),
    });

    if (!session) {
      socket.close();
      return;
    }

    initializeHeartbeat(session.user.id);
    await registerSocket(session.user.id, socket);

    socket.on("message", async (data) => {
      try {
        const payload = JSON.parse(String(data));
        await handleClientMessage(session.user.id, payload);
      } catch (error) {
        sendError(socket, (error as Error).message);
      }
    });

    socket.on("close", async () => {
      unregisterSocket(session.user.id, socket);
    });
  });
}
