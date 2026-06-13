"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useRealtime } from "@/components/realtime-provider";
import type { MessageDTO } from "@/lib/realtime-events";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function MessageThread({
  conversationId,
  title,
  otherUserId,
  currentUserId,
  initialMessages,
}: {
  conversationId: string;
  title: string;
  otherUserId: string | null;
  currentUserId: string;
  initialMessages: MessageDTO[];
}) {
  const { socket, connected, onlineUsers } = useRealtime();
  const router = useRouter();
  const [messages, setMessages] = useState<MessageDTO[]>(initialMessages);
  const [input, setInput] = useState("");
  const [peerTyping, setPeerTyping] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);

  const online = otherUserId ? onlineUsers.has(otherUserId) : false;

  // Reset thread state when navigating between conversations.
  useEffect(() => {
    setMessages(initialMessages);
    setPeerTyping(null);
  }, [conversationId, initialMessages]);

  // Join the conversation room and subscribe to events.
  useEffect(() => {
    if (!socket) return;

    socket.emit("conversation:join", conversationId);

    const onMessage = (msg: MessageDTO) => {
      if (msg.conversationId !== conversationId) return;
      setMessages((prev) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
      );
    };

    const onTyping = (data: {
      conversationId: string;
      userId: string;
      name: string;
      isTyping: boolean;
    }) => {
      if (data.conversationId !== conversationId || data.userId === currentUserId) return;
      setPeerTyping(data.isTyping ? data.name : null);
    };

    socket.on("message:new", onMessage);
    socket.on("typing", onTyping);

    return () => {
      socket.emit("conversation:leave", conversationId);
      socket.off("message:new", onMessage);
      socket.off("typing", onTyping);
    };
  }, [socket, connected, conversationId, currentUserId]);

  // Auto-scroll to the newest message.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, peerTyping]);

  function handleInputChange(value: string) {
    setInput(value);
    if (!socket) return;
    const now = Date.now();
    if (now - lastTypingSent.current > 1500) {
      socket.emit("typing", { conversationId, isTyping: true });
      lastTypingSent.current = now;
    }
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit("typing", { conversationId, isTyping: false });
      lastTypingSent.current = 0;
    }, 1800);
  }

  function startCall(withVideo: boolean) {
    // Notify the other member(s), then enter the call room.
    socket?.emit("call:invite", { conversationId, withVideo });
    router.push(`/call/${conversationId}${withVideo ? "" : "?video=0"}`);
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    const content = input.trim();
    if (!content || !socket) return;
    socket.emit("message:send", { conversationId, content });
    socket.emit("typing", { conversationId, isTyping: false });
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    lastTypingSent.current = 0;
    setInput("");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900 px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600/80 text-sm font-semibold text-white">
            {initials(title)}
          </div>
          <div>
            <div className="text-sm font-semibold text-white">{title}</div>
            <div className="text-xs text-slate-500">
              {online ? "Active now" : "Offline"}
            </div>
          </div>
        </div>
        {/* Call controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => startCall(false)}
            disabled={!connected}
            title="Start voice call"
            className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-slate-200 transition hover:bg-slate-800 disabled:opacity-40"
          >
            📞
          </button>
          <button
            onClick={() => startCall(true)}
            disabled={!connected}
            title="Start video call"
            className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-slate-200 transition hover:bg-slate-800 disabled:opacity-40"
          >
            🎥
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-slate-500">
            No messages yet. Say hello! 👋
          </p>
        )}
        {messages.map((m) => {
          const mine = m.sender.id === currentUserId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                  mine
                    ? "rounded-br-sm bg-indigo-600 text-white"
                    : "rounded-bl-sm bg-slate-800 text-slate-100"
                }`}
              >
                {!mine && (
                  <div className="mb-0.5 text-xs font-medium text-indigo-300">
                    {m.sender.name}
                  </div>
                )}
                <div className="whitespace-pre-wrap break-words text-sm">{m.content}</div>
                <div
                  className={`mt-1 text-[10px] ${mine ? "text-indigo-200" : "text-slate-500"}`}
                >
                  {formatTime(m.createdAt)}
                </div>
              </div>
            </div>
          );
        })}
        {peerTyping && (
          <div className="text-xs italic text-slate-500">{peerTyping} is typing…</div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <form
        onSubmit={send}
        className="flex shrink-0 items-center gap-2 border-t border-slate-800 bg-slate-900 px-4 py-3"
      >
        <input
          value={input}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={connected ? "Type a message…" : "Connecting…"}
          disabled={!connected}
          className="flex-1 rounded-full border border-slate-700 bg-slate-800 px-4 py-2 text-white outline-none focus:border-indigo-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!connected || !input.trim()}
          className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
