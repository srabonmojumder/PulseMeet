"use client";

import { Fragment, memo, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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
  Users,
  Smile,
  Heart,
  Sparkles,
  Mic,
  Reply,
  Pencil,
  Trash2,
  Check,
  Clock,
  Image as ImageIcon,
  Pin,
  Search,
  CalendarClock,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { useRealtime } from "@/components/realtime-provider";
import { Avatar } from "@/components/avatar";
import type { AttachmentDTO, MessageDTO, ReactionDTO } from "@/lib/realtime-events";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(contentType: string) {
  return contentType.startsWith("image/");
}

function isAudio(contentType: string) {
  return contentType.startsWith("audio/");
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// "0:07" style timer for the voice recorder.
function formatDuration(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Compact "time left" label for disappearing messages.
function remainingLabel(expiresAtIso: string, nowMs: number) {
  const ms = new Date(expiresAtIso).getTime() - nowMs;
  if (ms <= 0) return "0s";
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.ceil(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.ceil(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.ceil(h / 24)}d`;
}

// Day label for date separators ("Today" / "Yesterday" / full date).
function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "Today";
  if (same(d, yest)) return "Yesterday";
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

const QUICK_EMOJI = [
  "😀", "😂", "🥰", "😍", "😎", "🤔", "😅", "😭",
  "👍", "🙏", "👏", "🔥", "🎉", "❤️", "💯", "✅",
  "😡", "😱", "🤝", "👀", "😴", "🥳", "💔", "🚀",
];

// The quick set shown on the per-message reaction picker.
const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "🎉"];

// Disappearing-message durations offered in the composer.
const EXPIRE_OPTIONS = [
  { label: "Off", value: 0 },
  { label: "1 min", value: 60 },
  { label: "1 hour", value: 3600 },
  { label: "1 day", value: 86400 },
];

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Wrap occurrences of the search term in <mark> (case-insensitive).
function highlightParts(text: string, highlight: string | undefined, keyBase: string): ReactNode {
  const q = highlight?.trim();
  if (!q) return text;
  const parts = text.split(new RegExp(`(${escapeRegExp(q)})`, "gi"));
  return parts.map((p, i) =>
    p.toLowerCase() === q.toLowerCase() ? (
      <mark key={`${keyBase}-h${i}`} className="rounded bg-amber-300/40 text-white">
        {p}
      </mark>
    ) : (
      <Fragment key={`${keyBase}-h${i}`}>{p}</Fragment>
    ),
  );
}

// Inline markdown: `code`, **bold**, *italic* / _italic_, links, @mentions — plus
// optional search highlighting on the plain text between tokens.
function renderInline(text: string, highlight: string | undefined, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex =
    /(`[^`]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|(_[^_\n]+_)|(https?:\/\/[^\s]+)|(@[A-Za-z0-9_.-]+)/g;
  let last = 0;
  let idx = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) {
      nodes.push(
        <span key={`${keyBase}-t${idx}`}>{highlightParts(text.slice(last, m.index), highlight, `${keyBase}-t${idx}`)}</span>,
      );
      idx += 1;
    }
    const tok = m[0];
    if (m[1]) {
      nodes.push(
        <code key={`${keyBase}-c${idx}`} className="rounded bg-black/30 px-1 py-0.5 font-mono text-[0.85em]">
          {tok.slice(1, -1)}
        </code>,
      );
    } else if (m[2]) {
      nodes.push(<strong key={`${keyBase}-b${idx}`}>{highlightParts(tok.slice(2, -2), highlight, `${keyBase}-b${idx}`)}</strong>);
    } else if (m[3] || m[4]) {
      nodes.push(<em key={`${keyBase}-i${idx}`}>{highlightParts(tok.slice(1, -1), highlight, `${keyBase}-i${idx}`)}</em>);
    } else if (m[5]) {
      nodes.push(
        <a
          key={`${keyBase}-l${idx}`}
          href={tok}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-white/40 underline-offset-2 hover:decoration-white"
        >
          {tok}
        </a>,
      );
    } else if (m[6]) {
      nodes.push(
        <span key={`${keyBase}-m${idx}`} className="rounded bg-indigo-400/20 px-1 font-medium text-indigo-200">
          {tok}
        </span>,
      );
    }
    idx += 1;
    last = m.index + tok.length;
  }
  if (last < text.length) {
    nodes.push(<span key={`${keyBase}-t${idx}`}>{highlightParts(text.slice(last), highlight, `${keyBase}-t${idx}`)}</span>);
  }
  return nodes;
}

// Render message text: fenced ```code blocks``` + inline markdown / links / mentions.
function renderText(text: string, highlight?: string): ReactNode[] {
  const segments = text.split(/(```[\s\S]*?```)/g);
  return segments.map((seg, i) => {
    if (seg.length >= 6 && seg.startsWith("```") && seg.endsWith("```")) {
      const code = seg.slice(3, -3).replace(/^\n/, "");
      return (
        <pre
          key={`code-${i}`}
          className="my-1 overflow-x-auto rounded-lg bg-black/30 p-2 font-mono text-[0.8em] text-white/90"
        >
          {code}
        </pre>
      );
    }
    return <span key={`seg-${i}`}>{renderInline(seg, highlight, `s${i}`)}</span>;
  });
}

// Synchronized "send effects": certain words/emoji trigger a celebratory burst
// on everyone's screen (it fires from message:new, which the room all receives).
const EFFECT_TRIGGERS: { test: RegExp; emojis: string[] }[] = [
  { test: /🎉|🎊|🥳|congrats|congratulation/i, emojis: ["🎉", "🎊", "✨", "🥳"] },
  { test: /🎂|🎈|happy birthday|\bbirthday\b/i, emojis: ["🎂", "🎉", "🥳", "🎈"] },
  { test: /❤️|💕|🥰|😍|love you/i, emojis: ["❤️", "💕", "😍", "🥰"] },
  { test: /🔥|🚀|💯|awesome|amazing/i, emojis: ["🔥", "🚀", "⭐", "💯"] },
];
function effectFor(content: string): string[] | null {
  for (const e of EFFECT_TRIGGERS) if (e.test.test(content)) return e.emojis;
  return null;
}

// Seconds from now until a datetime-local value (undefined if empty/past).
// Module-level so the `Date.now()` read stays out of the component render path.
function scheduleSecondsFrom(scheduleAt: string): number | undefined {
  if (!scheduleAt) return undefined;
  const diff = Math.round((new Date(scheduleAt).getTime() - Date.now()) / 1000);
  return diff > 0 ? diff : undefined;
}

// Group raw reactions into { emoji, count, names, mine } for display.
function groupReactions(reactions: ReactionDTO[], currentUserId: string) {
  const map = new Map<string, { emoji: string; count: number; names: string[]; mine: boolean }>();
  for (const r of reactions) {
    const g = map.get(r.emoji) ?? { emoji: r.emoji, count: 0, names: [], mine: false };
    g.count += 1;
    g.names.push(r.name);
    if (r.userId === currentUserId) g.mine = true;
    map.set(r.emoji, g);
  }
  return Array.from(map.values());
}

// Soft notification beep via Web Audio (no asset needed).
function playBeep() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    osc.start();
    osc.stop(ctx.currentTime + 0.26);
    osc.onended = () => ctx.close();
  } catch {
    // ignore (autoplay may be blocked until first interaction)
  }
}

type ReadEntry = { userId: string; lastReadAt: string | null };

function latestRead(reads: ReadEntry[]): number {
  return reads.reduce((max, r) => {
    if (!r.lastReadAt) return max;
    const t = new Date(r.lastReadAt).getTime();
    return t > max ? t : max;
  }, 0);
}

export function MessageThread({
  conversationId,
  title,
  isGroup = false,
  memberCount = 0,
  otherUserId,
  otherUserImage,
  currentUserId,
  initialMessages,
  initialReads = [],
}: {
  conversationId: string;
  title: string;
  isGroup?: boolean;
  memberCount?: number;
  otherUserId: string | null;
  otherUserImage?: string | null;
  currentUserId: string;
  initialMessages: MessageDTO[];
  initialReads?: ReadEntry[];
}) {
  const { socket, connected, onlineUsers } = useRealtime();
  const router = useRouter();
  const [messages, setMessages] = useState<MessageDTO[]>(initialMessages);
  const [input, setInput] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [peerTyping, setPeerTyping] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Whether the reader is parked at the bottom. Updated only on real scroll
  // events, so appending a message (which grows scrollHeight without firing a
  // scroll) preserves the pre-append answer — we auto-follow only if they were
  // already at the bottom, and never yank them down while reading history.
  const pinnedRef = useRef(true);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRef = useRef("");
  const [livePreview, setLivePreview] = useState<{ name: string; text: string } | null>(null);
  const [peerActive, setPeerActive] = useState<Set<string>>(new Set());
  const [flying, setFlying] = useState<{ id: string; emoji: string; left: number }[]>([]);
  const flyId = useRef(0);

  // New-feature state.
  const [replyingTo, setReplyingTo] = useState<MessageDTO | null>(null);
  const [editing, setEditing] = useState<{ id: string } | null>(null);
  const [expireSeconds, setExpireSeconds] = useState(0);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const emojiMenuRef = useRef<HTMLDivElement>(null);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [peerReadAt, setPeerReadAt] = useState<number>(() => latestRead(initialReads));
  const [nowMs, setNowMs] = useState(() => Date.now()); // ticks while messages are expiring
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sendAfterRef = useRef(true);

  // AI panels.
  const [catchup, setCatchup] = useState<{ open: boolean; loading: boolean; text: string; error: string }>(
    { open: false, loading: false, text: "", error: "" },
  );
  const [suggest, setSuggest] = useState<{ open: boolean; loading: boolean; list: string[]; error: string }>(
    { open: false, loading: false, list: [], error: "" },
  );

  // Search + scheduled send.
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [matchIndex, setMatchIndex] = useState(0);
  const [scheduleAt, setScheduleAt] = useState(""); // datetime-local string ("" = off)

  const online = otherUserId ? onlineUsers.has(otherUserId) : false;
  // Co-presence: is the other person actively viewing THIS chat right now?
  const peerHere = otherUserId ? peerActive.has(otherUserId) : false;
  const groupHereCount = peerActive.size;

  // Close the attach / emoji popovers on an outside click. We deliberately do
  // NOT use onMouseLeave: the native datetime-local picker renders in its own
  // layer outside the menu, so a mouseleave-to-close dismisses the menu the
  // instant the cursor reaches for a time. A native picker doesn't emit a
  // page-level mousedown, so this keeps the menu open while you set the time.
  useEffect(() => {
    if (!showAttachMenu && !showEmoji) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (showAttachMenu && attachMenuRef.current && !attachMenuRef.current.contains(t)) {
        setShowAttachMenu(false);
      }
      if (showEmoji && emojiMenuRef.current && !emojiMenuRef.current.contains(t)) {
        setShowEmoji(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [showAttachMenu, showEmoji]);

  function spawnFly(emoji: string) {
    const id = `${flyId.current++}`;
    const left = 8 + Math.random() * 78; // % from left
    setFlying((f) => [...f, { id, emoji, left }]);
    setTimeout(() => setFlying((f) => f.filter((x) => x.id !== id)), 1800);
  }

  function sendReaction(emoji: string) {
    socket?.emit("reaction:fly", { conversationId, emoji });
    spawnFly(emoji);
  }

  // Row callbacks are memoized so each memo'd MessageRow keeps stable props and
  // skips re-rendering while you type in the composer.
  const togglePin = useCallback(
    (m: MessageDTO) => {
      socket?.emit("message:pin", { messageId: m.id, pinned: !m.pinnedAt }, (res) => {
        if (!res.ok) alert(res.error ?? "Couldn't pin the message");
      });
      setPickerFor(null);
    },
    [socket],
  );

  const markRead = useCallback(() => {
    socket?.emit("read", { conversationId });
  }, [socket, conversationId]);

  // Note: per-conversation state is reset by remounting (the parent passes
  // key={conversationId}), so there's no manual reset effect here.

  // Join the conversation room and subscribe to events.
  useEffect(() => {
    if (!socket) return;

    socket.emit("conversation:join", conversationId);

    const onMessage = (msg: MessageDTO) => {
      if (msg.conversationId !== conversationId) return;
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      // A real message clears that sender's live preview.
      setLivePreview((p) => (p && p.name === msg.sender.name ? null : p));
      // Synchronized send effect — every member receives this event, so the
      // celebratory burst fires for everyone at once (the sender included).
      const fx = effectFor(msg.content);
      if (fx) for (let k = 0; k < 14; k++) setTimeout(() => spawnFly(fx[k % fx.length]), k * 55);
      if (msg.sender.id !== currentUserId) {
        if (typeof document !== "undefined" && document.hidden) {
          playBeep();
          document.title = `💬 ${msg.sender.name} — PulseMeet`;
        } else {
          markRead();
        }
      }
    };

    // Edits, deletes and reaction changes all arrive as a full replacement.
    const onUpdate = (msg: MessageDTO) => {
      if (msg.conversationId !== conversationId) return;
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
    };

    const onRead = (data: { conversationId: string; userId: string; at: string }) => {
      if (data.conversationId !== conversationId || data.userId === currentUserId) return;
      const t = new Date(data.at).getTime();
      setPeerReadAt((prev) => (t > prev ? t : prev));
    };

    const onTyping = (data: {
      conversationId: string;
      userId: string;
      name: string;
      isTyping: boolean;
      text?: string;
    }) => {
      if (data.conversationId !== conversationId || data.userId === currentUserId) return;
      setPeerTyping(data.isTyping ? data.name : null);
      if (data.isTyping && data.text && data.text.trim().length > 0) {
        setLivePreview({ name: data.name, text: data.text });
      } else {
        setLivePreview(null);
      }
    };

    const onPresence = (data: { conversationId: string; userId: string; active: boolean }) => {
      if (data.conversationId !== conversationId || data.userId === currentUserId) return;
      setPeerActive((prev) => {
        const next = new Set(prev);
        if (data.active) next.add(data.userId);
        else next.delete(data.userId);
        return next;
      });
    };

    const onFly = (data: { conversationId: string; userId: string; emoji: string }) => {
      if (data.conversationId !== conversationId || data.userId === currentUserId) return;
      spawnFly(data.emoji);
    };

    socket.on("message:new", onMessage);
    socket.on("message:update", onUpdate);
    socket.on("read", onRead);
    socket.on("typing", onTyping);
    socket.on("convo:presence", onPresence);
    socket.on("reaction:fly", onFly);

    // Announce I'm actively viewing this conversation + mark it read.
    socket.emit("convo:active", { conversationId, active: true });
    markRead();

    return () => {
      socket.emit("convo:active", { conversationId, active: false });
      socket.emit("conversation:leave", conversationId);
      socket.off("message:new", onMessage);
      socket.off("message:update", onUpdate);
      socket.off("read", onRead);
      socket.off("typing", onTyping);
      socket.off("convo:presence", onPresence);
      socket.off("reaction:fly", onFly);
    };
  }, [socket, connected, conversationId, currentUserId, markRead]);

  // While any disappearing messages are alive, tick once a second so their
  // countdown updates and expired ones drop out of the render-time filter.
  const hasExpiring = messages.some((m) => m.expiresAt);
  useEffect(() => {
    if (!hasExpiring) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hasExpiring]);

  // Follow new messages / the typing indicator — but only when the reader is
  // already at the bottom, and smoothly.
  useEffect(() => {
    if (pinnedRef.current) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, peerTyping]);

  // The peer's live draft updates many times a second; nudge instantly (no
  // animation) so we don't stack overlapping smooth scrolls and jank the UI.
  useEffect(() => {
    if (livePreview && pinnedRef.current) bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, [livePreview]);

  // Restore the document title + mark read when the tab regains focus.
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden) {
        document.title = "PulseMeet";
        markRead();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      document.title = "PulseMeet";
    };
  }, [markRead]);

  // Auto-grow the composer textarea.
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`;
  }, [input]);

  function stopTyping() {
    if (emitTimer.current) {
      clearTimeout(emitTimer.current);
      emitTimer.current = null;
    }
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    socket?.emit("typing", { conversationId, isTyping: false });
  }

  // Live typing: stream the draft text to peers (throttled ~160ms). Suppressed
  // while editing so an edit-in-progress doesn't leak as a "new" draft.
  function handleInputChange(value: string) {
    setInput(value);
    draftRef.current = value;
    if (!socket || editing) return;

    if (!emitTimer.current) {
      socket.emit("typing", { conversationId, isTyping: true, text: value });
      emitTimer.current = setTimeout(() => {
        emitTimer.current = null;
        socket?.emit("typing", { conversationId, isTyping: true, text: draftRef.current });
      }, 160);
    }

    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(stopTyping, 3000);
  }

  function startCall(withVideo: boolean) {
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

  const startReply = useCallback((m: MessageDTO) => {
    setEditing(null);
    setReplyingTo(m);
    setPickerFor(null);
    textareaRef.current?.focus();
  }, []);

  const startEdit = useCallback((m: MessageDTO) => {
    setReplyingTo(null);
    setEditing({ id: m.id });
    setInput(m.content);
    draftRef.current = m.content;
    setPickerFor(null);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, []);

  function cancelEdit() {
    setEditing(null);
    setInput("");
    draftRef.current = "";
  }

  function saveEdit() {
    if (!editing || !socket) return;
    const text = input.trim();
    if (!text) return;
    socket.emit("message:edit", { messageId: editing.id, content: text }, (res) => {
      if (!res.ok) alert(res.error ?? "Edit failed");
    });
    cancelEdit();
  }

  const deleteMessage = useCallback(
    (id: string) => {
      if (!socket) return;
      if (!confirm("Delete this message for everyone?")) return;
      socket.emit("message:delete", { messageId: id }, (res) => {
        if (!res.ok) alert(res.error ?? "Delete failed");
      });
    },
    [socket],
  );

  const toggleReaction = useCallback(
    (messageId: string, emoji: string) => {
      socket?.emit("reaction:toggle", { messageId, emoji });
      setPickerFor(null);
    },
    [socket],
  );

  const togglePicker = useCallback(
    (id: string) => setPickerFor((p) => (p === id ? null : id)),
    [],
  );

  const scrollToMessage = useCallback((id: string) => {
    const el = document.getElementById(`msg-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("pm-flash");
      setTimeout(() => el.classList.remove("pm-flash"), 1200);
    }
  }, []);

  async function send(e: React.SyntheticEvent) {
    e.preventDefault();
    if (editing) {
      saveEdit();
      return;
    }
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

    // Scheduled send: seconds-from-now (must be in the future).
    const scheduleSeconds = scheduleSecondsFrom(scheduleAt);

    socket.emit(
      "message:send",
      {
        conversationId,
        content,
        attachments,
        replyToId: replyingTo?.id,
        expireSeconds: expireSeconds || undefined,
        scheduleSeconds,
      },
      (res) => {
        // Scheduled messages aren't broadcast yet, so add ours locally as pending.
        if (res.ok && res.message && scheduleSeconds) {
          setMessages((prev) =>
            prev.some((m) => m.id === res.message!.id) ? prev : [...prev, res.message!],
          );
        } else if (!res.ok) {
          alert(res.error ?? "Couldn't send the message");
        }
      },
    );
    stopTyping();
    draftRef.current = "";
    setInput("");
    setPendingFiles([]);
    setReplyingTo(null);
    setScheduleAt("");
    setSuggest((s) => ({ ...s, open: false }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ---- Voice messages ---------------------------------------------------
  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia) {
      alert("Voice recording isn't supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      sendAfterRef.current = true;
      mr.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (recordTimerRef.current) clearInterval(recordTimerRef.current);
        const chunks = chunksRef.current;
        chunksRef.current = [];
        if (!sendAfterRef.current || chunks.length === 0) return;
        const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
        if (blob.size === 0) return;
        const file = new File([blob], "voice-message.webm", { type: blob.type || "audio/webm" });
        setUploading(true);
        try {
          const atts = await uploadAll([file]);
          socket?.emit("message:send", {
            conversationId,
            content: "",
            attachments: atts,
            replyToId: replyingTo?.id,
            expireSeconds: expireSeconds || undefined,
          });
          setReplyingTo(null);
        } catch {
          alert("Couldn't send the voice message.");
        }
        setUploading(false);
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch {
      alert("Microphone access was denied.");
    }
  }

  function finishRecording(sendIt: boolean) {
    sendAfterRef.current = sendIt;
    setRecording(false);
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
  }

  // ---- AI ---------------------------------------------------------------
  async function callAI(action: "catchup" | "replies") {
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, action }),
    });
    return res.json();
  }

  async function runCatchup() {
    setCatchup({ open: true, loading: true, text: "", error: "" });
    try {
      const data = await callAI("catchup");
      if (data.error) setCatchup({ open: true, loading: false, text: "", error: data.error });
      else setCatchup({ open: true, loading: false, text: data.summary || "Nothing notable.", error: "" });
    } catch {
      setCatchup({ open: true, loading: false, text: "", error: "Couldn't reach the AI service." });
    }
  }

  async function runSuggestions() {
    setSuggest({ open: true, loading: true, list: [], error: "" });
    try {
      const data = await callAI("replies");
      if (data.error) setSuggest({ open: true, loading: false, list: [], error: data.error });
      else setSuggest({ open: true, loading: false, list: data.replies || [], error: "" });
    } catch {
      setSuggest({ open: true, loading: false, list: [], error: "Couldn't reach the AI service." });
    }
  }

  function applySuggestion(text: string) {
    setInput(text);
    setSuggest((s) => ({ ...s, open: false }));
    textareaRef.current?.focus();
  }

  const canSend = connected && !uploading && (input.trim().length > 0 || pendingFiles.length > 0);
  // Hide disappearing messages whose time is up (nowMs ticks them out of view).
  const visibleMessages = messages.filter(
    (m) => !m.expiresAt || new Date(m.expiresAt).getTime() > nowMs,
  );
  // For DIRECT chats: id of my last visible message (for the "Seen" receipt).
  const lastMineId = [...visibleMessages].reverse().find((m) => m.sender.id === currentUserId && !m.deletedAt)?.id;

  // Pinned messages (newest first).
  const pinned = visibleMessages
    .filter((m) => m.pinnedAt && !m.deletedAt)
    .sort((a, b) => new Date(b.pinnedAt!).getTime() - new Date(a.pinnedAt!).getTime());

  // Search matches within the conversation.
  const trimmedQuery = searchQuery.trim().toLowerCase();
  const matches =
    searchOpen && trimmedQuery
      ? visibleMessages.filter((m) => !m.deletedAt && m.content.toLowerCase().includes(trimmedQuery))
      : [];
  const activeMatchId = matches.length ? matches[Math.min(matchIndex, matches.length - 1)]?.id : undefined;

  function jumpMatch(dir: 1 | -1) {
    if (!matches.length) return;
    const next = (matchIndex + dir + matches.length) % matches.length;
    setMatchIndex(next);
    const id = matches[next]?.id;
    if (id) scrollToMessage(id);
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* Floating reactions overlay (synchronized across members) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-20 z-30 overflow-hidden">
        {flying.map((f) => (
          <span key={f.id} className="pm-float absolute text-3xl" style={{ left: `${f.left}%` }}>
            {f.emoji}
          </span>
        ))}
      </div>

      {/* Header */}
      <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-white/5 px-3 sm:gap-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Link
            href="/chat"
            className="-ml-1 flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/5 hover:text-white sm:hidden"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className={`rounded-full ${peerHere ? "pm-glow" : ""}`}>
            {isGroup ? (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
                <Users size={18} />
              </div>
            ) : (
              <Avatar name={title} image={otherUserImage} online={online} />
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">{title}</div>
            <div className="flex items-center gap-1.5 text-xs">
              {isGroup ? (
                groupHereCount > 0 ? (
                  <span className="flex items-center gap-1.5 text-indigo-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 pm-pulse" />
                    {groupHereCount} here now
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-white/40">
                    <Users size={12} /> {memberCount} members
                  </span>
                )
              ) : peerHere ? (
                <span className="flex items-center gap-1.5 font-medium text-indigo-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 pm-pulse" />
                  Here together now
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-white/40">
                  <span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-emerald-400" : "bg-white/30"}`} />
                  {online ? "Active now" : "Offline"}
                </span>
              )}
            </div>
          </div>
        </div>
        {/* Controls */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <button
            onClick={() => {
              setSearchOpen((s) => !s);
              setSearchQuery("");
            }}
            title="Search messages"
            className={`flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 transition hover:bg-white/5 hover:text-white sm:h-9 sm:w-9 ${
              searchOpen ? "bg-white/10 text-white" : "text-white/70"
            }`}
          >
            <Search size={16} />
          </button>
          <button
            onClick={runCatchup}
            disabled={!connected}
            title="Catch me up (AI summary)"
            className="flex h-8 items-center gap-1.5 rounded-xl border border-white/10 px-2 text-xs font-medium text-white/70 transition hover:border-amber-400/40 hover:bg-amber-400/10 hover:text-amber-300 disabled:opacity-40 sm:h-9 sm:px-2.5"
          >
            <Sparkles size={15} />
            <span className="hidden sm:inline">Catch me up</span>
          </button>
          <button
            onClick={() => sendReaction("💜")}
            disabled={!connected}
            title="Send a live pulse 💜"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 text-white/70 transition hover:border-pink-500/40 hover:bg-pink-500/10 hover:text-pink-400 disabled:opacity-40 sm:h-9 sm:w-9"
          >
            <Heart size={17} />
          </button>
          <button
            onClick={() => startCall(false)}
            disabled={!connected}
            title="Start voice call"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 text-white/70 transition hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-400 disabled:opacity-40 sm:h-9 sm:w-9"
          >
            <Phone size={17} />
          </button>
          <button
            onClick={() => startCall(true)}
            disabled={!connected}
            title="Start video call"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 text-white/70 transition hover:border-indigo-500/40 hover:bg-indigo-500/10 hover:text-indigo-400 disabled:opacity-40 sm:h-9 sm:w-9"
          >
            <Video size={17} />
          </button>
        </div>
      </div>

      {/* Search bar */}
      {searchOpen && (
        <div className="flex items-center gap-2 border-b border-white/5 bg-white/[0.03] px-4 py-2 sm:px-6">
          <Search size={15} className="shrink-0 text-white/40" />
          <input
            autoFocus
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setMatchIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                jumpMatch(e.shiftKey ? -1 : 1);
              }
              if (e.key === "Escape") {
                setSearchOpen(false);
                setSearchQuery("");
              }
            }}
            placeholder="Search this conversation…"
            className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 outline-none"
          />
          {trimmedQuery && (
            <span className="shrink-0 text-xs tabular-nums text-white/40">
              {matches.length ? `${Math.min(matchIndex, matches.length - 1) + 1}/${matches.length}` : "0/0"}
            </span>
          )}
          <button
            type="button"
            onClick={() => jumpMatch(-1)}
            disabled={!matches.length}
            title="Previous"
            className="shrink-0 rounded-lg p-1 text-white/50 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
          >
            <ChevronUp size={16} />
          </button>
          <button
            type="button"
            onClick={() => jumpMatch(1)}
            disabled={!matches.length}
            title="Next"
            className="shrink-0 rounded-lg p-1 text-white/50 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
          >
            <ChevronDown size={16} />
          </button>
          <button
            type="button"
            onClick={() => {
              setSearchOpen(false);
              setSearchQuery("");
            }}
            className="shrink-0 rounded-lg p-1 text-white/50 transition hover:bg-white/10 hover:text-white"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Pinned messages banner */}
      {pinned.length > 0 && (
        <button
          type="button"
          onClick={() => scrollToMessage(pinned[0].id)}
          className="flex w-full items-center gap-2 border-b border-amber-400/15 bg-amber-400/[0.05] px-4 py-2 text-left transition hover:bg-amber-400/10 sm:px-6"
        >
          <Pin size={14} className="shrink-0 -rotate-45 text-amber-300" />
          <div className="min-w-0 flex-1 text-xs">
            <span className="font-semibold text-amber-300/90">
              Pinned{pinned.length > 1 ? ` · ${pinned.length}` : ""}
            </span>
            <span className="ml-2 text-white/55">
              {pinned[0].sender.name}: {pinned[0].content || (pinned[0].attachments.length ? "📎 Attachment" : "")}
            </span>
          </div>
        </button>
      )}

      {/* AI "Catch me up" panel */}
      {catchup.open && (
        <div className="border-b border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 sm:px-6">
          <div className="flex items-start gap-2">
            <Sparkles size={16} className="mt-0.5 shrink-0 text-amber-300" />
            <div className="min-w-0 flex-1 text-sm">
              <div className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-amber-300/80">
                Catch me up
              </div>
              {catchup.loading ? (
                <div className="flex items-center gap-2 text-white/50">
                  <Loader2 size={14} className="animate-spin" /> Summarizing the conversation…
                </div>
              ) : catchup.error ? (
                <p className="text-rose-300/90">{catchup.error}</p>
              ) : (
                <p className="whitespace-pre-wrap text-white/85">{catchup.text}</p>
              )}
            </div>
            <button
              onClick={() => setCatchup((c) => ({ ...c, open: false }))}
              className="shrink-0 rounded-lg p-1 text-white/40 transition hover:bg-white/10 hover:text-white"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        }}
        className="min-h-0 flex-1 space-y-1 overflow-y-auto px-4 py-4 sm:px-6"
      >
        {visibleMessages.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <MessageCircle size={32} className="text-white/20" />
            <p className="text-sm text-white/40">No messages yet. Say hello! 👋</p>
          </div>
        )}
        {visibleMessages.map((m, i) => (
          <MessageRow
            key={m.id}
            m={m}
            prev={visibleMessages[i - 1]}
            currentUserId={currentUserId}
            isGroup={isGroup}
            lastMineId={lastMineId}
            peerReadAt={peerReadAt}
            nowMs={nowMs}
            activeMatchId={activeMatchId}
            pickerOpen={pickerFor === m.id}
            searchHighlight={searchOpen && trimmedQuery ? searchQuery : undefined}
            onTogglePicker={togglePicker}
            onReact={toggleReaction}
            onReply={startReply}
            onPin={togglePin}
            onEdit={startEdit}
            onDelete={deleteMessage}
            onJumpTo={scrollToMessage}
          />
        ))}

        {/* PulseMeet Live Typing — see the peer's draft in real time */}
        {livePreview ? (
          <div className="flex justify-start pt-3">
            <div className="max-w-[78%] rounded-2xl rounded-bl-md border border-dashed border-indigo-400/50 bg-indigo-500/[0.07] px-4 py-2 text-sm sm:max-w-[68%]">
              <div className="mb-0.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-300">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 pm-pulse" />
                {livePreview.name} · typing live
              </div>
              <div className="whitespace-pre-wrap break-words text-white/80">
                {renderText(livePreview.text)}
                <span className="ml-0.5 inline-block h-3.5 w-px bg-indigo-300 pm-pulse align-middle" />
              </div>
            </div>
          </div>
        ) : peerTyping ? (
          <div className="flex items-center gap-1.5 pt-2 text-xs text-white/40">
            <span className="flex gap-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-white/40 pm-pulse" style={{ animationDelay: "0ms" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-white/40 pm-pulse" style={{ animationDelay: "200ms" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-white/40 pm-pulse" style={{ animationDelay: "400ms" }} />
            </span>
            {peerTyping} is typing…
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <form
        onSubmit={send}
        className="shrink-0 border-t border-white/5 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4"
      >
        {/* Smart replies */}
        {suggest.open && (
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-[11px] font-medium text-amber-300/80">
              <Sparkles size={12} /> Smart replies
            </span>
            {suggest.loading ? (
              <span className="flex items-center gap-1.5 text-xs text-white/40">
                <Loader2 size={12} className="animate-spin" /> Thinking…
              </span>
            ) : suggest.error ? (
              <span className="text-xs text-rose-300/90">{suggest.error}</span>
            ) : (
              suggest.list.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => applySuggestion(s)}
                  className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs text-amber-100 transition hover:bg-amber-400/20"
                >
                  {s}
                </button>
              ))
            )}
            <button
              type="button"
              onClick={() => setSuggest((s) => ({ ...s, open: false }))}
              className="rounded-lg p-1 text-white/40 transition hover:bg-white/10 hover:text-white"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* Reply / edit banner */}
        {(replyingTo || editing) && (
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs">
            {editing ? (
              <Pencil size={13} className="shrink-0 text-amber-300" />
            ) : (
              <Reply size={13} className="shrink-0 text-indigo-300" />
            )}
            <div className="min-w-0 flex-1">
              <span className="font-semibold text-white/80">
                {editing ? "Editing message" : `Replying to ${replyingTo?.sender.name}`}
              </span>
              {replyingTo && (
                <span className="ml-2 truncate text-white/40">
                  {replyingTo.content || (replyingTo.attachments.length ? "📎 Attachment" : "")}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => (editing ? cancelEdit() : setReplyingTo(null))}
              className="shrink-0 rounded-lg p-1 text-white/50 transition hover:bg-white/10 hover:text-white"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {expireSeconds > 0 && (
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-indigo-400/30 bg-indigo-500/10 px-3 py-1.5 text-xs text-indigo-200">
            <Clock size={13} className="shrink-0" />
            <span className="flex-1">
              Disappears after {EXPIRE_OPTIONS.find((o) => o.value === expireSeconds)?.label}
            </span>
            <button
              type="button"
              onClick={() => setExpireSeconds(0)}
              title="Turn off"
              className="shrink-0 rounded-lg p-1 text-indigo-200/70 transition hover:bg-white/10 hover:text-white"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {scheduleAt && new Date(scheduleAt).getTime() > nowMs && (
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-violet-400/30 bg-violet-500/10 px-3 py-1.5 text-xs text-violet-200">
            <CalendarClock size={13} className="shrink-0" />
            <span className="flex-1">
              Sends{" "}
              {new Date(scheduleAt).toLocaleString([], {
                weekday: "short",
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <button
              type="button"
              onClick={() => setScheduleAt("")}
              title="Cancel schedule"
              className="shrink-0 rounded-lg p-1 text-violet-200/70 transition hover:bg-white/10 hover:text-white"
            >
              <X size={13} />
            </button>
          </div>
        )}

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

        {recording ? (
          <div className="flex items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500 pm-pulse" />
            <span className="text-sm font-medium text-rose-200">Recording… {formatDuration(recordSeconds)}</span>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => finishRecording(false)}
              className="rounded-lg px-3 py-1.5 text-xs text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => finishRecording(true)}
              title="Send voice message"
              className="brand-gradient flex h-9 w-9 items-center justify-center rounded-xl text-white"
            >
              <SendHorizontal size={17} />
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            {/* Hidden file inputs: general files + images-only */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length) setPendingFiles((p) => [...p, ...files].slice(0, 10));
                e.target.value = "";
              }}
            />
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length) setPendingFiles((p) => [...p, ...files].slice(0, 10));
                e.target.value = "";
              }}
            />

            {/* Attach & options menu (paperclip opens a popup) */}
            <div className="relative shrink-0" ref={attachMenuRef}>
              <button
                type="button"
                onClick={() => setShowAttachMenu((s) => !s)}
                disabled={!connected}
                title="Attach & options"
                className={`flex h-10 w-10 items-center justify-center rounded-xl transition disabled:opacity-40 ${
                  showAttachMenu || expireSeconds > 0
                    ? "bg-white/10 text-white"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Paperclip size={19} />
              </button>
              {showAttachMenu && (
                <div className="pm-rise absolute bottom-12 left-0 z-50 w-60 rounded-2xl border border-white/10 bg-[#15151f] p-1.5 shadow-2xl">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAttachMenu(false);
                      imageInputRef.current?.click();
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/85 transition hover:bg-white/10"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300">
                      <ImageIcon size={16} />
                    </span>
                    Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAttachMenu(false);
                      fileInputRef.current?.click();
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/85 transition hover:bg-white/10"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300">
                      <FileText size={16} />
                    </span>
                    File
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAttachMenu(false);
                      startRecording();
                    }}
                    disabled={uploading}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/85 transition hover:bg-white/10 disabled:opacity-40"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/15 text-rose-300">
                      <Mic size={16} />
                    </span>
                    Voice message
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAttachMenu(false);
                      runSuggestions();
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/85 transition hover:bg-white/10"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400/15 text-amber-300">
                      <Sparkles size={16} />
                    </span>
                    AI smart replies
                  </button>

                  <div className="my-1 border-t border-white/10" />
                  <div className="px-2 pb-1 pt-1">
                    <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-white/40">
                      <Clock size={12} /> Disappear after
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {EXPIRE_OPTIONS.map((o) => (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => setExpireSeconds(o.value)}
                          className={`rounded-lg px-2.5 py-1 text-xs transition ${
                            expireSeconds === o.value
                              ? "bg-indigo-500/25 text-indigo-200"
                              : "bg-white/5 text-white/60 hover:bg-white/10"
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="my-1 border-t border-white/10" />
                  <div className="px-2 pb-1 pt-1">
                    <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-white/40">
                      <CalendarClock size={12} /> Schedule send
                    </div>
                    <input
                      type="datetime-local"
                      value={scheduleAt}
                      onChange={(e) => setScheduleAt(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white outline-none [color-scheme:dark]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Emoji picker */}
            <div className="relative shrink-0" ref={emojiMenuRef}>
              <button
                type="button"
                onClick={() => setShowEmoji((s) => !s)}
                disabled={!connected}
                title="Emoji"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-white/60 transition hover:bg-white/5 hover:text-white disabled:opacity-40"
              >
                <Smile size={19} />
              </button>
              {showEmoji && (
                <div className="pm-rise absolute bottom-12 left-0 z-50 grid w-64 grid-cols-8 gap-1 rounded-2xl border border-white/10 bg-[#15151f] p-2 shadow-2xl">
                  {QUICK_EMOJI.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => {
                        setInput((v) => v + e);
                        textareaRef.current?.focus();
                      }}
                      className="rounded-lg p-1 text-xl transition hover:bg-white/10"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <textarea
              ref={textareaRef}
              value={input}
              rows={1}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(e);
                }
                if (e.key === "Escape" && editing) cancelEdit();
              }}
              placeholder={
                connected
                  ? editing
                    ? "Edit your message…  (Enter to save, Esc to cancel)"
                    : "Type a message…  (Enter to send, Shift+Enter for new line)"
                  : "Connecting…"
              }
              disabled={!connected}
              className="max-h-36 flex-1 resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-indigo-500/60 focus:bg-white/[0.07] disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={editing ? input.trim().length === 0 : !canSend}
              title={editing ? "Save edit" : "Send"}
              className="brand-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-lg shadow-indigo-500/25 transition hover:opacity-95 disabled:opacity-40 disabled:shadow-none"
            >
              {uploading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : editing ? (
                <Check size={18} />
              ) : (
                <SendHorizontal size={18} />
              )}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

// One message row — memoized so typing in the composer (which re-renders the
// parent) doesn't re-render every bubble. Only rows whose props actually change
// re-render; the parent's row callbacks are useCallback-stable to keep it so.
const MessageRow = memo(function MessageRow({
  m,
  prev,
  currentUserId,
  isGroup,
  lastMineId,
  peerReadAt,
  nowMs,
  activeMatchId,
  pickerOpen,
  searchHighlight,
  onTogglePicker,
  onReact,
  onReply,
  onPin,
  onEdit,
  onDelete,
  onJumpTo,
}: {
  m: MessageDTO;
  prev: MessageDTO | undefined;
  currentUserId: string;
  isGroup: boolean;
  lastMineId: string | undefined;
  peerReadAt: number;
  nowMs: number;
  activeMatchId: string | undefined;
  pickerOpen: boolean;
  searchHighlight: string | undefined;
  onTogglePicker: (id: string) => void;
  onReact: (id: string, emoji: string) => void;
  onReply: (m: MessageDTO) => void;
  onPin: (m: MessageDTO) => void;
  onEdit: (m: MessageDTO) => void;
  onDelete: (id: string) => void;
  onJumpTo: (id: string) => void;
}) {
  const mine = m.sender.id === currentUserId;
  const showDay = !prev || dayLabel(prev.createdAt) !== dayLabel(m.createdAt);
  const grouped = prev && prev.sender.id === m.sender.id && !showDay && !m.replyTo;
  const deleted = Boolean(m.deletedAt);
  const groupedReactions = groupReactions(m.reactions, currentUserId);
  const showSeen = !isGroup && mine && m.id === lastMineId && peerReadAt >= new Date(m.createdAt).getTime();
  const scheduled = Boolean(m.scheduledFor && new Date(m.scheduledFor).getTime() > nowMs);
  const isActiveMatch = m.id === activeMatchId;

  return (
    <div id={`msg-${m.id}`} className="pm-msg">
      {showDay && (
        <div className="my-3 flex justify-center">
          <span
            suppressHydrationWarning
            className="rounded-full bg-white/5 px-3 py-1 text-[11px] text-white/40"
          >
            {dayLabel(m.createdAt)}
          </span>
        </div>
      )}
      <div
        className={`group flex items-center gap-1.5 ${mine ? "justify-end" : "justify-start"} ${
          grouped ? "mt-0.5" : "mt-3"
        }`}
      >
        {/* Hover actions (left of my bubbles) */}
        {mine && !deleted && (
          <MessageActions
            mine
            pinned={Boolean(m.pinnedAt)}
            pickerOpen={pickerOpen}
            onTogglePicker={() => onTogglePicker(m.id)}
            onReact={(emoji) => onReact(m.id, emoji)}
            onReply={() => onReply(m)}
            onPin={() => onPin(m)}
            onEdit={() => onEdit(m)}
            onDelete={() => onDelete(m.id)}
          />
        )}

        <div className="flex min-w-0 max-w-[78%] flex-col sm:max-w-[68%]">
          <div
            className={`px-4 py-2 text-sm shadow-sm ${isActiveMatch ? "ring-2 ring-amber-300/70 " : ""}${
              deleted
                ? "rounded-2xl border border-white/10 bg-white/[0.03] italic text-white/40"
                : mine
                  ? "brand-gradient rounded-2xl rounded-br-md text-white"
                  : "rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.06] text-slate-100"
            }`}
          >
            {!mine && !grouped && !deleted && (
              <div className="mb-0.5 text-xs font-semibold text-indigo-300">{m.sender.name}</div>
            )}

            {/* Quoted reply */}
            {m.replyTo && !deleted && (
              <button
                type="button"
                onClick={() => onJumpTo(m.replyTo!.id)}
                className={`mb-1.5 block w-full rounded-lg border-l-2 px-2 py-1 text-left text-xs ${
                  mine
                    ? "border-white/50 bg-white/10 text-white/80"
                    : "border-indigo-400/60 bg-indigo-400/10 text-white/70"
                }`}
              >
                <span className="block font-semibold">{m.replyTo.senderName}</span>
                <span className="line-clamp-2 opacity-80">
                  {m.replyTo.content || (m.replyTo.hasAttachments ? "📎 Attachment" : "Message")}
                </span>
              </button>
            )}

            {deleted ? (
              <span>🚫 This message was deleted</span>
            ) : (
              <>
                {m.content && (
                  <div className="whitespace-pre-wrap break-words">
                    {renderText(m.content, searchHighlight)}
                  </div>
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
                            className="max-h-64 max-w-full rounded-xl border border-white/10"
                          />
                        </a>
                      ) : isAudio(a.contentType) ? (
                        <div
                          key={a.url}
                          className={`flex items-center gap-2 rounded-xl px-2.5 py-2 ${
                            mine ? "bg-white/15" : "bg-white/[0.06]"
                          }`}
                        >
                          <Mic size={16} className="shrink-0 opacity-80" />
                          <audio src={a.url} controls className="h-8 max-w-[200px]" />
                        </div>
                      ) : (
                        <a
                          key={a.url}
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                          download={a.name}
                          className={`group/att flex items-center gap-3 rounded-xl px-3 py-2 ${
                            mine ? "bg-white/15" : "bg-white/[0.06]"
                          }`}
                        >
                          <FileText size={20} className="shrink-0 opacity-80" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{a.name}</span>
                            <span className="block text-[11px] opacity-70">{formatBytes(a.size)}</span>
                          </span>
                          <Download size={16} className="shrink-0 opacity-50 transition group-hover/att:opacity-100" />
                        </a>
                      ),
                    )}
                  </div>
                )}
              </>
            )}

            <div
              suppressHydrationWarning
              className={`mt-1 flex items-center justify-end gap-1.5 text-[10px] ${
                mine ? "text-white/70" : "text-white/35"
              }`}
            >
              {scheduled && (
                <span className="flex items-center gap-0.5 rounded-full bg-black/20 px-1.5 py-0.5">
                  <CalendarClock size={9} /> Scheduled · {formatTime(m.scheduledFor!)}
                </span>
              )}
              {m.pinnedAt && !deleted && <Pin size={9} className="-rotate-45 opacity-70" />}
              {m.expiresAt && !deleted && (
                <span className="flex items-center gap-0.5 rounded-full bg-black/20 px-1.5 py-0.5">
                  <Clock size={9} /> {remainingLabel(m.expiresAt, nowMs)}
                </span>
              )}
              {m.editedAt && !deleted && <span className="opacity-70">edited</span>}
              {formatTime(m.createdAt)}
            </div>
          </div>

          {/* Reaction chips */}
          {groupedReactions.length > 0 && (
            <div className={`mt-1 flex flex-wrap gap-1 ${mine ? "justify-end" : "justify-start"}`}>
              {groupedReactions.map((g) => (
                <button
                  key={g.emoji}
                  type="button"
                  title={g.names.join(", ")}
                  onClick={() => onReact(m.id, g.emoji)}
                  className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs transition ${
                    g.mine
                      ? "border-indigo-400/60 bg-indigo-500/20 text-white"
                      : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                  }`}
                >
                  <span>{g.emoji}</span>
                  <span className="text-[10px] tabular-nums">{g.count}</span>
                </button>
              ))}
            </div>
          )}

          {showSeen && (
            <div className="mt-0.5 flex justify-end pr-0.5 text-[10px] text-indigo-300/80">
              <span className="flex items-center gap-0.5">
                <Check size={11} /> Seen
              </span>
            </div>
          )}
        </div>

        {/* Hover actions (right of others' bubbles) */}
        {!mine && !deleted && (
          <MessageActions
            mine={false}
            pinned={Boolean(m.pinnedAt)}
            pickerOpen={pickerOpen}
            onTogglePicker={() => onTogglePicker(m.id)}
            onReact={(emoji) => onReact(m.id, emoji)}
            onReply={() => onReply(m)}
            onPin={() => onPin(m)}
          />
        )}
      </div>
    </div>
  );
});

// Hover toolbar shown beside each message: react, reply, pin, and (own messages) edit/delete.
function MessageActions({
  mine,
  pinned,
  pickerOpen,
  onTogglePicker,
  onReact,
  onReply,
  onPin,
  onEdit,
  onDelete,
}: {
  mine: boolean;
  pinned: boolean;
  pickerOpen: boolean;
  onTogglePicker: () => void;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onPin: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      className={`pm-actions relative flex shrink-0 items-center gap-0.5 self-center transition ${
        pickerOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"
      }`}
    >
      <div className="relative">
        <button
          type="button"
          onClick={onTogglePicker}
          title="React"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-white/40 transition hover:bg-white/10 hover:text-white"
        >
          <Smile size={15} />
        </button>
        {pickerOpen && (
          <div
            className={`pm-rise absolute bottom-9 z-50 flex gap-0.5 rounded-full border border-white/10 bg-[#15151f] px-1.5 py-1 shadow-2xl ${
              mine ? "right-0" : "left-0"
            }`}
          >
            {REACTIONS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => onReact(e)}
                className="rounded-full p-1 text-lg leading-none transition hover:scale-125 hover:bg-white/10"
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onReply}
        title="Reply"
        className="flex h-7 w-7 items-center justify-center rounded-lg text-white/40 transition hover:bg-white/10 hover:text-white"
      >
        <Reply size={15} />
      </button>
      <button
        type="button"
        onClick={onPin}
        title={pinned ? "Unpin" : "Pin"}
        className={`flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-white/10 hover:text-white ${
          pinned ? "text-amber-300" : "text-white/40"
        }`}
      >
        <Pin size={14} className="-rotate-45" />
      </button>
      {mine && onEdit && (
        <button
          type="button"
          onClick={onEdit}
          title="Edit"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-white/40 transition hover:bg-white/10 hover:text-white"
        >
          <Pencil size={14} />
        </button>
      )}
      {mine && onDelete && (
        <button
          type="button"
          onClick={onDelete}
          title="Delete"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-white/40 transition hover:bg-rose-500/15 hover:text-rose-400"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}
