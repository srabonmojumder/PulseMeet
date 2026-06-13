"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Search, SquarePen, X, MessagesSquare, Loader2, Paperclip } from "lucide-react";
import type { ConversationListItem } from "@/lib/queries";
import { useRealtime } from "@/components/realtime-provider";
import { Avatar } from "@/components/avatar";
import { searchUsers, startDirectConversation } from "@/app/(app)/chat/actions";

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
          title="New conversation"
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
          const title = c.otherUser?.name ?? c.name ?? "Conversation";
          const online = c.otherUser ? onlineUsers.has(c.otherUser.id) : false;
          const isActive = c.id === activeId;
          const isAttachmentOnly = !!c.lastMessage && !c.lastMessage.content;
          const prefix = c.lastMessage?.senderId === currentUserId ? "You: " : "";
          const preview = !c.lastMessage
            ? "No messages yet"
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
              <Avatar name={title} image={c.otherUser?.image} online={online} />
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

function NewChatModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    { id: string; name: string; email: string; image: string | null }[]
  >([]);
  const [pending, startTransition] = useTransition();

  function runSearch(q: string) {
    setQuery(q);
    startTransition(async () => setResults(await searchUsers(q)));
  }

  function pick(userId: string) {
    startTransition(async () => {
      await startDirectConversation(userId);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 pt-28 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass pm-rise w-full max-w-md rounded-2xl p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">Start a conversation</h3>
          <button onClick={onClose} className="text-white/40 transition hover:text-white">
            <X size={18} />
          </button>
        </div>
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
        <div className="max-h-72 overflow-y-auto">
          {!pending && results.length === 0 && (
            <p className="px-1 py-3 text-sm text-white/40">
              {query ? "No people found." : "Type to search for people."}
            </p>
          )}
          {results.map((u) => (
            <button
              key={u.id}
              onClick={() => pick(u.id)}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/5"
            >
              <Avatar name={u.name} image={u.image} />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-white">{u.name}</div>
                <div className="truncate text-xs text-white/40">{u.email}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
