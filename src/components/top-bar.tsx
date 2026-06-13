"use client";

import { signOut } from "next-auth/react";
import { LogOut, Wifi, WifiOff } from "lucide-react";
import { useRealtime } from "@/components/realtime-provider";
import { Logo } from "@/components/logo";
import { Avatar } from "@/components/avatar";

export function TopBar({ name, email }: { name: string; email: string }) {
  const { connected } = useRealtime();

  return (
    <header className="glass flex h-16 shrink-0 items-center justify-between px-4 sm:px-5">
      <div className="flex items-center gap-3">
        <Logo size="sm" />
        <span
          className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs sm:inline-flex ${
            connected
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : "border-white/10 bg-white/5 text-white/50"
          }`}
          title={connected ? "Realtime connected" : "Connecting…"}
        >
          {connected ? <Wifi size={13} /> : <WifiOff size={13} className="pm-pulse" />}
          {connected ? "Connected" : "Connecting"}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden text-right leading-tight sm:block">
          <div className="text-sm font-medium text-white">{name}</div>
          <div className="text-xs text-white/40">{email}</div>
        </div>
        <Avatar name={name} size="sm" />
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          title="Sign out"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-white/60 transition hover:bg-white/5 hover:text-white"
        >
          <LogOut size={17} />
        </button>
      </div>
    </header>
  );
}
