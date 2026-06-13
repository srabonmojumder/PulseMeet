import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { attachRealtime } from "@/server/realtime";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from "@/lib/realtime-events";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    Record<string, never>,
    SocketData
  >(httpServer, {
    // Permissive in dev so phones/tunnels on other origins can connect;
    // locked to the app URL in production.
    cors: {
      origin: dev ? true : process.env.NEXT_PUBLIC_APP_URL || true,
      credentials: true,
    },
  });

  attachRealtime(io);

  httpServer.listen(port, () => {
    console.log(`> PulseMeet ready on http://${hostname}:${port}  (dev=${dev})`);
  });
});
