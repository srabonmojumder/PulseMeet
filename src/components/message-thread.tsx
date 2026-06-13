"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Phone,
  Video,
  Paperclip,
  SendHorizontal,
  X,
  FileText,
  Download,
  ArrowLeft,
  MessageCircle,
  Loader2,
} from "lucide-react";
import { useRealtime } from "@/components/realtime-provider";
import { Avatar } from "@/components/avatar";
import type { AttachmentDTO, MessageDTO } from "@/lib/realtime-events";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(contentType: string) {
  return contentType.startsWith("image/");
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function MessageThread({
  conversationId,
  title,
  otherUserId,
  otherUserImage,
  currentUserId,
  initialMessages,
}: {
  conversationId: string;
  title: string;
  otherUserId: string | null;
  otherUserImage?: string | null;
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
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
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

  const canSend = connected && !uploading && (input.trim().length > 0 || pendingFiles.length > 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/5 px-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/chat"
            className="-ml-1 flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/5 hover:text-white sm:hidden"
          >
            <ArrowLeft size={18} />
          </Link>
          <Avatar name={title} image={otherUserImage} online={online} />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">{title}</div>
            <div className="flex items-center gap-1.5 text-xs text-white/40">
              <span
                className={`h-1.5 w-1.5 rounded-full ${online ? "bg-emerald-400" : "bg-white/30"}`}
              />
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
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-white/70 transition hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-400 disabled:opacity-40"
          >
            <Phone size={17} />
          </button>
          <button
            onClick={() => startCall(true)}
            disabled={!connected}
            title="Start video call"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-white/70 transition hover:border-indigo-500/40 hover:bg-indigo-500/10 hover:text-indigo-400 disabled:opacity-40"
          >
            <Video size={17} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-4 py-4 sm:px-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <MessageCircle size={32} className="text-white/20" />
            <p className="text-sm text-white/40">No messages yet. Say hello! 👋</p>
          </div>
        )}
        {messages.map((m, i) => {
          const mine = m.sender.id === currentUserId;
          const prev = messages[i - 1];
          const grouped = prev && prev.sender.id === m.sender.id;
          return (
            <div
              key={m.id}
              className={`flex ${mine ? "justify-end" : "justify-start"} ${grouped ? "mt-0.5" : "mt-3"}`}
            >
              <div
                className={`max-w-[78%] px-4 py-2 text-sm shadow-sm sm:max-w-[68%] ${
                  mine
                    ? "brand-gradient rounded-2xl rounded-br-md text-white"
                    : "rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.06] text-slate-100"
                }`}
              >
                {!mine && !grouped && (
                  <div className="mb-0.5 text-xs font-semibold text-indigo-300">
                    {m.sender.name}
                  </div>
                )}
                {m.content && (
                  <div className="whitespace-pre-wrap break-words">{m.content}</div>
                )}
                {m.attachments.length > 0 && (
                  <div className="mt-1.5 space-y-1.5">
                    {m.attachments.map((a) =>
                      isImage(a.contentType) ? (
                        <a key={a.url} href={a.url} target="_blank" rel="noreferrer" className="block">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={a.url}
                            alt={a.name}
                            className="max-h-64 rounded-xl border border-white/10"
                          />
                        </a>
                      ) : (
                        <a
                          key={a.url}
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                          download={a.name}
                          className={`group flex items-center gap-3 rounded-xl px-3 py-2 ${
                            mine ? "bg-white/15" : "bg-white/[0.06]"
                          }`}
                        >
                          <FileText size={20} className="shrink-0 opacity-80" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{a.name}</span>
                            <span className="block text-[11px] opacity-70">{formatBytes(a.size)}</span>
                          </span>
                          <Download size={16} className="shrink-0 opacity-50 transition group-hover:opacity-100" />
                        </a>
                      ),
                    )}
                  </div>
                )}
                <div
                  suppressHydrationWarning
                  className={`mt-1 text-right text-[10px] ${mine ? "text-white/70" : "text-white/35"}`}
                >
                  {formatTime(m.createdAt)}
                </div>
              </div>
            </div>
          );
        })}
        {peerTyping && (
          <div className="flex items-center gap-1.5 pt-2 text-xs text-white/40">
            <span className="flex gap-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-white/40 pm-pulse" style={{ animationDelay: "0ms" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-white/40 pm-pulse" style={{ animationDelay: "200ms" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-white/40 pm-pulse" style={{ animationDelay: "400ms" }} />
            </span>
            {peerTyping} is typing…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <form onSubmit={send} className="shrink-0 border-t border-white/5 px-3 py-3 sm:px-4">
        {pendingFiles.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {pendingFiles.map((f, i) => (
              <span
                key={`${f.name}-${i}`}
                className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1 pl-3 pr-2 text-xs text-white/80"
              >
                <Paperclip size={12} />
                <span className="max-w-40 truncate">{f.name}</span>
                <span className="opacity-50">{formatBytes(f.size)}</span>
                <button
                  type="button"
                  onClick={() => setPendingFiles((p) => p.filter((_, j) => j !== i))}
                  className="flex h-4 w-4 items-center justify-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
                >
                  <X size={12} />
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
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white/60 transition hover:bg-white/5 hover:text-white disabled:opacity-40"
          >
            <Paperclip size={19} />
          </button>
          <input
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder={connected ? "Type a message…" : "Connecting…"}
            disabled={!connected}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-indigo-500/60 focus:bg-white/[0.07] disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!canSend}
            title="Send"
            className="brand-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-lg shadow-indigo-500/25 transition hover:opacity-95 disabled:opacity-40 disabled:shadow-none"
          >
            {uploading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <SendHorizontal size={18} />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
