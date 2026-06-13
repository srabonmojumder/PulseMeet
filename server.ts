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
const port = parseInt(process.env.PORT || "3000", 10);

// Note: we deliberately do NOT pass a fixed `hostname` to next(). Hardcoding
// "localhost" makes Auth.js treat localhost as the base URL, so post-login
// redirects point at localhost — which breaks login from other devices (a
// phone's "localhost" is the phone itself). Letting Next use the real request
// host (with AUTH_TRUST_HOST=true) keeps redirects on the correct origin.
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    // Behind this custom server there's no reverse proxy, so Auth.js (with
    // trustHost) can't derive the origin and falls back to localhost — which
    // breaks logins from other devices. Forward the real host/proto so the
    // post-login redirect stays on the origin the client actually used.
    // Fill in only the forwarding headers the upstream proxy didn't set — never
    // clobber a proxy-provided x-forwarded-proto (Render sets it to https; the
    // raw socket here is plain http, so overwriting it broke secure cookies).
    if (req.headers.host && !req.headers["x-forwarded-host"]) {
      req.headers["x-forwarded-host"] = req.headers.host;
    }
    if (!req.headers["x-forwarded-proto"]) {
      req.headers["x-forwarded-proto"] =
        (req.socket as { encrypted?: boolean }).encrypted ? "https" : "http";
    }
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
    console.log(`> PulseMeet ready on http://localhost:${port}  (dev=${dev})`);
  });
});
