"use client";

import { useState, useTransition } from "react";
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
  const activeId = params?.conversationId;
  const { onlineUsers } = useRealtime();
  const [showNew, setShowNew] = useState(false);
  const [filter, setFilter] = useState("");

  const filtered = conversations.filter((c) => {
    const title = c.otherUser?.name ?? c.name ?? "";
    return title.toLowerCase().includes(filter.toLowerCase());
  });

  return (
    <aside className="glass flex w-full shrink-0 flex-col overflow-hidden sm:w-80 sm:rounded-2xl">
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

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
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
                <div className="truncate text-sm font-medium text-white">{title}</div>
                <div className="flex items-center gap-1 truncate text-xs text-white/40">
                  {isAttachmentOnly && <Paperclip size={12} className="shrink-0" />}
                  <span className="truncate">{preview}</span>
                </div>
              </div>
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

  function createGroup() {
    setError(null);
    startTransition(async () => {
      const res = await createGroupConversation(
        groupName,
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
    });
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
            placeholder="Group name…"
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
            disabled={pending || !groupName.trim() || selected.length < 2}
            className="brand-gradient mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:opacity-95 disabled:opacity-40"
          >
            {pending ? <Loader2 size={16} className="animate-spin" /> : <Users size={16} />}
            Create group ({selected.length} selected)
          </button>
        )}
      </div>
    </div>
  );
}
