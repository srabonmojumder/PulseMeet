"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { LogOut, Wifi, WifiOff, Settings, ChevronDown } from "lucide-react";
import { useRealtime } from "@/components/realtime-provider";
import { Logo } from "@/components/logo";
import { Avatar } from "@/components/avatar";
import { InstallButton } from "@/components/install-button";

export function TopBar({
  name,
  email,
  image,
}: {
  name: string;
  email: string;
  image: string | null;
}) {
  const { connected } = useRealtime();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <header className="glass flex h-16 shrink-0 items-center justify-between px-4 sm:px-5">
      <div className="flex items-center gap-3">
        <Link href="/chat">
          <Logo size="sm" />
        </Link>
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

      <div className="flex items-center gap-2">
        <InstallButton />
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2 rounded-xl border border-white/10 py-1 pl-1 pr-2 transition hover:bg-white/5"
          >
            <Avatar name={name} image={image} size="sm" />
            <span className="hidden max-w-32 truncate text-sm font-medium text-white sm:block">
              {name}
            </span>
            <ChevronDown size={15} className="text-white/40" />
          </button>

          {open && (
            <div className="glass pm-rise absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl p-1.5 shadow-2xl">
              <div className="flex items-center gap-3 px-2.5 py-2">
                <Avatar name={name} image={image} size="md" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-white">{name}</div>
                  <div className="truncate text-xs text-white/40">{email}</div>
                </div>
              </div>
              <div className="my-1 h-px bg-white/10" />
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm text-white/80 transition hover:bg-white/5"
              >
                <Settings size={16} /> Profile &amp; settings
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm text-rose-300 transition hover:bg-rose-500/10"
              >
                <LogOut size={16} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
