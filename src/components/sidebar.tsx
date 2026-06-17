"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Search,
  SquarePen,
  X,
  MessagesSquare,
  Loader2,
  Paperclip,
  Users,
  Check,
} from "lucide-react";
import type { ConversationListItem } from "@/lib/queries";
import { useRealtime } from "@/components/realtime-provider";
import { Avatar } from "@/components/avatar";
import {
  searchUsers,
  startDirectConversation,
  createGroupConversation,
} from "@/app/(app)/chat/actions";

function GroupAvatar() {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
      <Users size={18} />
    </div>
  );
}

export function Sidebar({
  conversations,
  currentUserId,
}: {
  conversations: ConversationListItem[];
  currentUserId: string;
}) {
  const params = useParams<{ conversationId?: string }>();
  const router = useRouter();
  const activeId = params?.conversationId;
  const { onlineUsers, socket } = useRealtime();
  const [showNew, setShowNew] = useState(false);
  const [filter, setFilter] = useState("");

  // Live overlay: most-recent message per conversation, layered on top of the
  // server-rendered list so a new message bumps the chat to the top without a
  // full reload. `unread` flags chats with messages you haven't opened yet.
  const [overlay, setOverlay] = useState<
    Map<string, { content: string; createdAt: string; senderId: string }>
  >(new Map());
  const [unread, setUnread] = useState<Set<string>>(new Set());

  // Refs so the socket handler (registered once) reads the latest values without
  // re-subscribing on every navigation. Updated in effects, not during render.
  const activeIdRef = useRef(activeId);
  const knownIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);
  useEffect(() => {
    knownIdsRef.current = new Set(conversations.map((c) => c.id));
  }, [conversations]);

  // A new message anywhere lands here (via each member's personal room).
  useEffect(() => {
    if (!socket) return;
    function onActivity(data: {
      conversationId: string;
      senderId: string;
      preview: string;
      hasAttachment: boolean;
      createdAt: string;
    }) {
      const { conversationId, senderId, preview, hasAttachment, createdAt } = data;
      // A chat that isn't in our list yet (e.g. someone just started a new one):
      // pull a fresh server list so it appears.
      if (!knownIdsRef.current.has(conversationId)) {
        router.refresh();
        return;
      }
      setOverlay((prev) => {
        const next = new Map(prev);
        next.set(conversationId, {
          content: hasAttachment && !preview ? "" : preview,
          createdAt,
          senderId,
        });
        return next;
      });
      // Flag unread unless it's my own message or I'm already viewing the chat.
      if (senderId !== currentUserId && conversationId !== activeIdRef.current) {
        setUnread((prev) => (prev.has(conversationId) ? prev : new Set(prev).add(conversationId)));
      }
    }
    socket.on("conversation:activity", onActivity);
    return () => {
      socket.off("conversation:activity", onActivity);
    };
  }, [socket, currentUserId, router]);

  // Clear a chat's unread flag when you open it (fired on the row click below).
  const markRead = (id: string) =>
    setUnread((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

  // Merge the live overlay in, then float chats with newer activity to the top.
  // Array.sort is stable, so chats without live activity keep the server order.
  const bumpTs = (id: string) => {
    const ov = overlay.get(id);
    return ov ? new Date(ov.createdAt).getTime() : 0;
  };
  const ordered = conversations
    .map((c) => {
      const ov = overlay.get(c.id);
      return ov ? { ...c, lastMessage: ov } : c;
    })
    .sort((a, b) => bumpTs(b.id) - bumpTs(a.id));

  const filtered = ordered.filter((c) => {
    const title = c.otherUser?.name ?? c.name ?? "";
    return title.toLowerCase().includes(filter.toLowerCase());
  });

  return (
    <aside className="glass flex h-full w-full min-h-0 flex-col overflow-hidden sm:rounded-2xl">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <h2 className="text-sm font-semibold text-white">Messages</h2>
        <button
          onClick={() => setShowNew(true)}
          title="New conversation or group"
          className="brand-gradient flex h-8 w-8 items-center justify-center rounded-lg text-white shadow-md shadow-indigo-500/25 transition hover:opacity-95"
        >
          <SquarePen size={16} />
        </button>
      </div>

      <div className="px-4 pb-2">
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3">
          <Search size={16} className="text-white/40" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search conversations"
            className="flex-1 bg-transparent py-2 text-sm text-white placeholder:text-white/30 outline-none"
          />
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <MessagesSquare size={28} className="text-white/20" />
            <p className="text-sm text-white/40">
              {conversations.length === 0 ? "No conversations yet." : "No matches."}
            </p>
          </div>
        )}
        {filtered.map((c) => {
          const isGroup = c.type === "GROUP";
          const title = isGroup ? c.name ?? "Group" : c.otherUser?.name ?? "Conversation";
          const online = !isGroup && c.otherUser ? onlineUsers.has(c.otherUser.id) : false;
          const isActive = c.id === activeId;
          // The chat you're viewing is never "unread".
          const isUnread = unread.has(c.id) && !isActive;
          const isAttachmentOnly = !!c.lastMessage && !c.lastMessage.content;
          const prefix = c.lastMessage?.senderId === currentUserId ? "You: " : "";
          const preview = !c.lastMessage
            ? isGroup
              ? `${c.memberCount} members`
              : "No messages yet"
            : isAttachmentOnly
              ? `${prefix}Attachment`
              : `${prefix}${c.lastMessage.content}`;
          return (
            <Link
              key={c.id}
              href={`/chat/${c.id}`}
              onClick={() => markRead(c.id)}
              className={`mb-0.5 flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition ${
                isActive ? "bg-white/10" : "hover:bg-white/5"
              }`}
            >
              {isGroup ? (
                <GroupAvatar />
              ) : (
                <Avatar name={title} image={c.otherUser?.image} online={online} />
              )}
              <div className="min-w-0 flex-1">
                <div
                  className={`truncate text-sm text-white ${isUnread ? "font-semibold" : "font-medium"}`}
                >
                  {title}
                </div>
                <div
                  className={`flex items-center gap-1 truncate text-xs ${
                    isUnread ? "text-white/75" : "text-white/40"
                  }`}
                >
                  {isAttachmentOnly && <Paperclip size={12} className="shrink-0" />}
                  <span className="truncate">{preview}</span>
                </div>
              </div>
              {isUnread && (
                <span
                  title="New message"
                  className="brand-gradient ml-1 h-2.5 w-2.5 shrink-0 rounded-full shadow-sm shadow-indigo-500/50"
                />
              )}
            </Link>
          );
        })}
      </nav>

      {showNew && <NewChatModal onClose={() => setShowNew(false)} />}
    </aside>
  );
}

type FoundUser = { id: string; name: string; email: string; image: string | null };

function NewChatModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [mode, setMode] = useState<"direct" | "group">("direct");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoundUser[]>([]);
  const [pending, startTransition] = useTransition();

  // group mode
  const [groupName, setGroupName] = useState("");
  const [selected, setSelected] = useState<FoundUser[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function runSearch(q: string) {
    setQuery(q);
    startTransition(async () => setResults(await searchUsers(q)));
  }

  function pickDirect(userId: string) {
    startTransition(async () => {
      await startDirectConversation(userId);
    });
  }

  function toggleSelect(u: FoundUser) {
    setSelected((prev) =>
      prev.some((s) => s.id === u.id) ? prev.filter((s) => s.id !== u.id) : [...prev, u],
    );
  }

  async function createGroup() {
    if (selected.length < 2 || creating) return;
    setError(null);
    setCreating(true);
    // Group name optional — default to the members' first names.
    const name =
      groupName.trim() || selected.map((s) => s.name.split(" ")[0]).join(", ");
    try {
      const res = await createGroupConversation(
        name,
        selected.map((s) => s.id),
      );
      if (res?.error) {
        setError(res.error);
        return;
      }
      if (res?.id) {
        onClose();
        router.push(`/chat/${res.id}`);
        router.refresh();
      }
    } catch {
      setError("Could not create the group. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 pt-24 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="pm-rise w-full max-w-md rounded-2xl border border-white/10 bg-[#15151f] p-5 shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">
            {mode === "direct" ? "New conversation" : "New group"}
          </h3>
          <button onClick={onClose} className="text-white/40 transition hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Mode toggle */}
        <div className="mb-3 flex gap-1 rounded-xl bg-white/5 p-1">
          {(["direct", "group"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition ${
                mode === m ? "bg-white/10 text-white" : "text-white/50 hover:text-white"
              }`}
            >
              {m === "direct" ? "Direct" : "Group"}
            </button>
          ))}
        </div>

        {mode === "group" && (
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Group name (optional)…"
            className="mb-2 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-indigo-500/60"
          />
        )}

        {mode === "group" && selected.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {selected.map((u) => (
              <span
                key={u.id}
                className="flex items-center gap-1 rounded-full bg-indigo-500/20 py-1 pl-2.5 pr-1.5 text-xs text-indigo-200"
              >
                {u.name}
                <button onClick={() => toggleSelect(u)} className="hover:text-white">
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="mb-3 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3">
          <Search size={16} className="text-white/40" />
          <input
            autoFocus
            value={query}
            onChange={(e) => runSearch(e.target.value)}
            placeholder="Search people by name or email…"
            className="flex-1 bg-transparent py-2.5 text-sm text-white placeholder:text-white/30 outline-none"
          />
          {pending && <Loader2 size={16} className="animate-spin text-white/40" />}
        </div>

        <div className="max-h-64 overflow-y-auto">
          {!pending && results.length === 0 && (
            <p className="px-1 py-3 text-sm text-white/40">
              {query ? "No people found." : "Type to search for people."}
            </p>
          )}
          {results.map((u) => {
            const isSel = selected.some((s) => s.id === u.id);
            return (
              <button
                key={u.id}
                onClick={() => (mode === "direct" ? pickDirect(u.id) : toggleSelect(u))}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/5"
              >
                <Avatar name={u.name} image={u.image} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-white">{u.name}</div>
                  <div className="truncate text-xs text-white/40">{u.email}</div>
                </div>
                {mode === "group" && (
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                      isSel ? "border-indigo-500 bg-indigo-500 text-white" : "border-white/20"
                    }`}
                  >
                    {isSel && <Check size={13} />}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {error && <p className="mt-2 text-sm text-rose-400">{error}</p>}

        {mode === "group" && (
          <button
            onClick={createGroup}
            disabled={creating || selected.length < 2}
            className="brand-gradient mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:opacity-95 disabled:opacity-40"
          >
            {creating ? <Loader2 size={16} className="animate-spin" /> : <Users size={16} />}
            {selected.length < 2
              ? "Select at least 2 people"
              : `Create group (${selected.length} selected)`}
          </button>
        )}
      </div>
    </div>
  );
}
