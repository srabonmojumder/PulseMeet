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
import { Phone, Video, PhoneCall, PhoneOff } from "lucide-react";
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

      // Same-origin in local/single-host setups; point at a dedicated realtime
      // host (e.g. Railway/Render) in serverless deploys via NEXT_PUBLIC_SOCKET_URL.
      const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || undefined;
      socket = io(socketUrl, {
        auth: { token },
        // Refresh the auth token on every (re)connection attempt.
        transports: ["websocket", "polling"],
        withCredentials: true,
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

  const CallIcon = invite.withVideo ? Video : Phone;

  return (
    <div className="pm-rise fixed bottom-6 right-6 z-[100] w-80 rounded-2xl border border-white/10 bg-[#15151f] p-4 shadow-2xl shadow-black/60">
      <div className="mb-3 flex items-center gap-3">
        <div className="brand-gradient flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg shadow-indigo-500/30">
          <CallIcon size={22} className="pm-pulse" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">{invite.from.name}</div>
          <div className="text-xs text-white/50">
            Incoming {invite.withVideo ? "video" : "voice"} call…
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={join}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-500"
        >
          <PhoneCall size={16} /> Join
        </button>
        <button
          onClick={onDismiss}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 py-2.5 text-sm text-white/70 transition hover:bg-white/5 hover:text-white"
        >
          <PhoneOff size={16} /> Dismiss
        </button>
      </div>
    </div>
  );
}
