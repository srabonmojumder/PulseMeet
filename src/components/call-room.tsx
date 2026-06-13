"use client";

import "@livekit/components-styles";
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
} from "@livekit/components-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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

  useEffect(() => {
    let active = true;
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
  }, [conversationId]);

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <p className="text-red-400">{error}</p>
        <Link
          href={`/chat/${conversationId}`}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Back to chat
        </Link>
      </div>
    );
  }

  if (!conn) {
    return (
      <div className="flex flex-1 items-center justify-center text-slate-400">
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
        onDisconnected={() => router.push(`/chat/${conversationId}`)}
      >
        <VideoConference />
        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  );
}
