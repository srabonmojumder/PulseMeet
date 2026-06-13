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
import { useRouter } from "next/navigation";
import type {
  CallInvite,
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
  const [incomingCall, setIncomingCall] = useState<CallInvite | null>(null);

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

      socket.on("call:incoming", (invite) => setIncomingCall(invite));
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

  return (
    <RealtimeContext.Provider value={value}>
      {children}
      {incomingCall && (
        <IncomingCallBanner
          invite={incomingCall}
          onDismiss={() => setIncomingCall(null)}
        />
      )}
    </RealtimeContext.Provider>
  );
}

function IncomingCallBanner({
  invite,
  onDismiss,
}: {
  invite: CallInvite;
  onDismiss: () => void;
}) {
  const router = useRouter();

  function join() {
    onDismiss();
    router.push(
      `/call/${invite.conversationId}${invite.withVideo ? "" : "?video=0"}`,
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-[100] w-80 rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-600 text-lg">
          {invite.withVideo ? "🎥" : "📞"}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">
            {invite.from.name}
          </div>
          <div className="text-xs text-slate-400">
            Incoming {invite.withVideo ? "video" : "voice"} call…
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={join}
          className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white transition hover:bg-emerald-500"
        >
          Join
        </button>
        <button
          onClick={onDismiss}
          className="flex-1 rounded-lg border border-slate-700 py-2 text-sm text-slate-300 transition hover:bg-slate-800"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
