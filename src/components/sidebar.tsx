"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ConversationListItem } from "@/lib/queries";
import { useRealtime } from "@/components/realtime-provider";
import { searchUsers, startDirectConversation } from "@/app/(app)/chat/actions";

function Avatar({ name, online }: { name: string; online?: boolean }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="relative">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600/80 text-sm font-semibold text-white">
        {initials}
      </div>
      {online !== undefined && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-900 ${
            online ? "bg-emerald-400" : "bg-slate-600"
          }`}
        />
      )}
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

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-slate-800 bg-slate-900">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Messages
        </h2>
        <button
          onClick={() => setShowNew(true)}
          className="rounded-lg bg-indigo-600 px-2.5 py-1 text-sm font-medium text-white transition hover:bg-indigo-500"
        >
          + New
        </button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto">
        {conversations.length === 0 && (
          <p className="px-4 py-6 text-sm text-slate-500">
            No conversations yet. Start one with “+ New”.
          </p>
        )}
        {conversations.map((c) => {
          const title = c.otherUser?.name ?? c.name ?? "Conversation";
          const online = c.otherUser ? onlineUsers.has(c.otherUser.id) : false;
          const isActive = c.id === activeId;
          return (
            <Link
              key={c.id}
              href={`/chat/${c.id}`}
              className={`flex items-center gap-3 px-4 py-3 transition ${
                isActive ? "bg-slate-800" : "hover:bg-slate-800/50"
              }`}
            >
              <Avatar name={title} online={online} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-white">{title}</div>
                <div className="truncate text-xs text-slate-500">
                  {c.lastMessage
                    ? `${c.lastMessage.senderId === currentUserId ? "You: " : ""}${c.lastMessage.content}`
                    : "No messages yet"}
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
    startTransition(async () => {
      const users = await searchUsers(q);
      setResults(users);
    });
  }

  function pick(userId: string) {
    startTransition(async () => {
      await startDirectConversation(userId);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-32"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-3 text-lg font-semibold text-white">Start a conversation</h3>
        <input
          autoFocus
          value={query}
          onChange={(e) => runSearch(e.target.value)}
          placeholder="Search people by name or email…"
          className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white outline-none focus:border-indigo-500"
        />
        <div className="max-h-72 overflow-y-auto">
          {pending && <p className="px-1 py-2 text-sm text-slate-500">Searching…</p>}
          {!pending && results.length === 0 && (
            <p className="px-1 py-2 text-sm text-slate-500">
              {query ? "No people found." : "Type to search for people."}
            </p>
          )}
          {results.map((u) => (
            <button
              key={u.id}
              onClick={() => pick(u.id)}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-slate-800"
            >
              <Avatar name={u.name} />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-white">{u.name}</div>
                <div className="truncate text-xs text-slate-500">{u.email}</div>
              </div>
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="mt-3 w-full rounded-lg border border-slate-700 py-2 text-sm text-slate-300 transition hover:bg-slate-800"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
