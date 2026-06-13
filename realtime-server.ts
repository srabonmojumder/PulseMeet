/**
 * Standalone realtime (Socket.io) server.
 *
 * Use this when the Next.js app is deployed somewhere that can't host a
 * long-lived WebSocket server (e.g. Vercel serverless). Run it on a host that
 * supports persistent processes (Railway, Render, Fly, a VPS):
 *
 *   tsx realtime-server.ts
 *
 * It shares the database (DATABASE_URL) and token secret (AUTH_SECRET) with the
 * web app. Set CORS_ORIGIN to the web app's public URL.
 *
 * For local single-process dev you don't need this — `pnpm dev` (server.ts)
 * runs Next.js and Socket.io together.
 */
import { createServer } from "node:http";
import { Server } from "socket.io";
import { attachRealtime } from "@/server/realtime";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from "@/lib/realtime-events";

const port = parseInt(process.env.REALTIME_PORT || process.env.PORT || "3101", 10);
const corsOrigin = process.env.CORS_ORIGIN || process.env.NEXT_PUBLIC_APP_URL || true;

const httpServer = createServer((req, res) => {
  // Lightweight health check for platform probes.
  if (req.url === "/healthz") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
    return;
  }
  res.writeHead(404);
  res.end();
});

const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>(httpServer, {
  cors: { origin: corsOrigin, credentials: true },
});

attachRealtime(io);

httpServer.listen(port, () => {
  console.log(`> PulseMeet realtime server on :${port} (cors: ${corsOrigin})`);
});
