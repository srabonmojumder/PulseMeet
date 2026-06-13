"use client";

import "@livekit/components-styles";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import { DisconnectReason } from "livekit-client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, PhoneOff, ArrowLeft, RotateCw } from "lucide-react";

function reasonLabel(reason?: DisconnectReason): string {
  switch (reason) {
    case DisconnectReason.DUPLICATE_IDENTITY:
      return "Joined from another device";
    case DisconnectReason.SERVER_SHUTDOWN:
      return "Call server restarted";
    case DisconnectReason.PARTICIPANT_REMOVED:
      return "You were removed from the call";
    case DisconnectReason.ROOM_DELETED:
      return "The call ended";
    case DisconnectReason.STATE_MISMATCH:
      return "Connection state mismatch";
    case DisconnectReason.JOIN_FAILURE:
      return "Failed to join the call (network/media)";
    default:
      return reason !== undefined ? `Disconnected (code ${reason})` : "Disconnected";
  }
}

export function CallRoom({
  conversationId,
  withVideo,
}: {
  conversationId: string;
  withVideo: boolean;
}) {
  const router = useRouter();
  const [conn, setConn] = useState<{ token: string; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0); // bump to force a fresh token + reconnect

  useEffect(() => {
    let active = true;
    setConn(null);
    setError(null);
    setEnded(null);
    fetch(`/api/livekit-token?room=${encodeURIComponent(conversationId)}`, {
      cache: "no-store",
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!active) return;
        if (!res.ok) {
          setError(data.error ?? "Could not join the call");
          return;
        }
        setConn({ token: data.token, url: data.url });
      })
      .catch(() => active && setError("Could not reach the call server"));
    return () => {
      active = false;
    };
  }, [conversationId, nonce]);

  if (error || ended) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-400">
          <PhoneOff size={26} />
        </div>
        <p className="text-rose-400">{error ?? ended}</p>
        <div className="flex gap-2">
          <button
            onClick={() => setNonce((n) => n + 1)}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
          >
            <RotateCw size={16} /> Rejoin
          </button>
          <Link
            href={`/chat/${conversationId}`}
            className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/5"
          >
            <ArrowLeft size={16} /> Back to chat
          </Link>
        </div>
      </div>
    );
  }

  if (!conn) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-white/50">
        <Loader2 size={28} className="animate-spin text-indigo-400" />
        Connecting to call…
      </div>
    );
  }

  return (
    <div className="flex-1" style={{ height: "100%" }}>
      <LiveKitRoom
        token={conn.token}
        serverUrl={conn.url}
        connect
        video={withVideo}
        audio
        data-lk-theme="default"
        style={{ height: "100%" }}
        onError={(e) => {
          console.error("[call] LiveKit error:", e);
          setError(e.message || "Call connection error");
        }}
        onDisconnected={(reason) => {
          console.warn("[call] disconnected, reason:", reason, DisconnectReason[reason ?? -1]);
          // Only an explicit leave returns to chat. Any other disconnect shows
          // the reason (and a Rejoin) instead of silently bouncing out.
          if (reason === DisconnectReason.CLIENT_INITIATED) {
            router.push(`/chat/${conversationId}`);
          } else {
            setEnded(reasonLabel(reason));
          }
        }}
      >
        {/* VideoConference already renders remote audio internally. */}
        <VideoConference />
      </LiveKitRoom>
    </div>
  );
}
