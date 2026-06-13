"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useRealtime } from "@/components/realtime-provider";
import type { AttachmentDTO, MessageDTO } from "@/lib/realtime-events";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(contentType: string) {
  return contentType.startsWith("image/");
}

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
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [peerTyping, setPeerTyping] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  async function uploadAll(files: File[]): Promise<AttachmentDTO[]> {
    const out: AttachmentDTO[] = [];
    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Failed to upload ${file.name}`);
      }
      out.push(await res.json());
    }
    return out;
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = input.trim();
    if ((!content && pendingFiles.length === 0) || !socket || uploading) return;

    let attachments: AttachmentDTO[] = [];
    if (pendingFiles.length > 0) {
      setUploading(true);
      try {
        attachments = await uploadAll(pendingFiles);
      } catch (err) {
        setUploading(false);
        alert(err instanceof Error ? err.message : "Upload failed");
        return;
      }
      setUploading(false);
    }

    socket.emit("message:send", { conversationId, content, attachments });
    socket.emit("typing", { conversationId, isTyping: false });
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    lastTypingSent.current = 0;
    setInput("");
    setPendingFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
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
                {m.content && (
                  <div className="whitespace-pre-wrap break-words text-sm">{m.content}</div>
                )}
                {m.attachments.length > 0 && (
                  <div className="mt-1 space-y-2">
                    {m.attachments.map((a) =>
                      isImage(a.contentType) ? (
                        <a key={a.url} href={a.url} target="_blank" rel="noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={a.url}
                            alt={a.name}
                            className="max-h-60 rounded-lg border border-black/10"
                          />
                        </a>
                      ) : (
                        <a
                          key={a.url}
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                          download={a.name}
                          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                            mine ? "bg-indigo-500/40" : "bg-slate-700/60"
                          }`}
                        >
                          <span className="text-lg">📎</span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{a.name}</span>
                            <span className="block text-[10px] opacity-70">
                              {formatBytes(a.size)}
                            </span>
                          </span>
                        </a>
                      ),
                    )}
                  </div>
                )}
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
        className="shrink-0 border-t border-slate-800 bg-slate-900 px-4 py-3"
      >
        {pendingFiles.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {pendingFiles.map((f, i) => (
              <span
                key={`${f.name}-${i}`}
                className="flex items-center gap-2 rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-200"
              >
                📎 <span className="max-w-40 truncate">{f.name}</span>
                <span className="opacity-60">{formatBytes(f.size)}</span>
                <button
                  type="button"
                  onClick={() => setPendingFiles((p) => p.filter((_, j) => j !== i))}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length) setPendingFiles((p) => [...p, ...files].slice(0, 10));
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!connected}
            title="Attach files"
            className="rounded-full border border-slate-700 px-3 py-2 text-slate-200 transition hover:bg-slate-800 disabled:opacity-40"
          >
            📎
          </button>
          <input
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder={connected ? "Type a message…" : "Connecting…"}
            disabled={!connected}
            className="flex-1 rounded-full border border-slate-700 bg-slate-800 px-4 py-2 text-white outline-none focus:border-indigo-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!connected || uploading || (!input.trim() && pendingFiles.length === 0)}
            className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {uploading ? "Sending…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
