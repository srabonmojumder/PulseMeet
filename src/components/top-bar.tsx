"use client";

import { signOut } from "next-auth/react";
import { useRealtime } from "@/components/realtime-provider";

export function TopBar({ name, email }: { name: string; email: string }) {
  const { connected } = useRealtime();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900 px-4">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600 text-sm font-bold text-white">
          P
        </div>
        <span className="font-semibold text-white">PulseMeet</span>
        <span
          className={`ml-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs ${
            connected ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-700 text-slate-400"
          }`}
          title={connected ? "Realtime connected" : "Connecting…"}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-400" : "bg-slate-500"}`}
          />
          {connected ? "Online" : "Connecting"}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right leading-tight">
          <div className="text-sm font-medium text-white">{name}</div>
          <div className="text-xs text-slate-500">{email}</div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
