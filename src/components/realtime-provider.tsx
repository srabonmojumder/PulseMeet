"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@/lib/realtime-events";

type AppClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface RealtimeContextValue {
  socket: AppClientSocket | null;
  connected: boolean;
  onlineUsers: Set<string>;
}

const RealtimeContext = createContext<RealtimeContextValue>({
  socket: null,
  connected: false,
  onlineUsers: new Set(),
});

export function useRealtime() {
  return useContext(RealtimeContext);
}

async function fetchToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/realtime-token", { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return data.token ?? null;
  } catch {
    return null;
  }
}

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<AppClientSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    let socket: AppClientSocket | null = null;

    (async () => {
      const token = await fetchToken();
      if (!active || !token) return;

      socket = io({
        auth: { token },
        // Refresh the auth token on every (re)connection attempt.
        transports: ["websocket", "polling"],
      });
      socketRef.current = socket;

      socket.on("connect", () => setConnected(true));
      socket.on("disconnect", () => setConnected(false));

      // When the short-lived token expires, fetch a fresh one before retrying.
      socket.io.on("reconnect_attempt", async () => {
        const fresh = await fetchToken();
        if (fresh && socket) socket.auth = { token: fresh };
      });

      socket.on("presence", ({ userId, online }) => {
        setOnlineUsers((prev) => {
          const next = new Set(prev);
          if (online) next.add(userId);
          else next.delete(userId);
          return next;
        });
      });
    })();

    return () => {
      active = false;
      socket?.disconnect();
      socketRef.current = null;
    };
  }, []);

  const value = useMemo<RealtimeContextValue>(
    () => ({ socket: socketRef.current, connected, onlineUsers }),
    [connected, onlineUsers],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}
