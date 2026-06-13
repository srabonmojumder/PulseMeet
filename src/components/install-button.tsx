"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Surfaces an install affordance:
// - Android / desktop Chrome/Edge: native install prompt via beforeinstallprompt.
// - iOS Safari: a hint to use Share → Add to Home Screen (iOS has no prompt API).
export function InstallButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent;
    const iOS =
      /iphone|ipad|ipod/i.test(ua) ||
      (ua.includes("Mac") && navigator.maxTouchPoints > 1);
    setIsIOS(iOS);
    setStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        // @ts-expect-error iOS Safari only
        window.navigator.standalone === true,
    );

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Already installed → nothing to show.
  if (standalone) return null;

  // Native prompt available (Android / desktop).
  if (deferred) {
    return (
      <button
        onClick={async () => {
          await deferred.prompt();
          await deferred.userChoice;
          setDeferred(null);
        }}
        className="flex items-center gap-1.5 rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-3 py-1.5 text-sm font-medium text-indigo-300 transition hover:bg-indigo-500/20"
      >
        <Download size={15} /> Install
      </button>
    );
  }

  // iOS: no prompt API — show manual instructions.
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSHelp(true)}
          className="flex items-center gap-1.5 rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-3 py-1.5 text-sm font-medium text-indigo-300 transition hover:bg-indigo-500/20"
        >
          <Download size={15} /> Install
        </button>
        {showIOSHelp && (
          <div
            className="fixed inset-0 z-[200] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
            onClick={() => setShowIOSHelp(false)}
          >
            <div
              className="pm-rise w-full max-w-sm rounded-2xl border border-white/10 bg-[#15151f] p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-white">Install on iPhone / iPad</h3>
                <button onClick={() => setShowIOSHelp(false)} className="text-white/40 hover:text-white">
                  <X size={18} />
                </button>
              </div>
              <ol className="space-y-3 text-sm text-white/70">
                <li className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs">1</span>
                  Tap the <Share size={15} className="inline text-indigo-300" /> <b className="text-white">Share</b> button in Safari
                </li>
                <li className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs">2</span>
                  Scroll and tap <b className="text-white">“Add to Home Screen”</b>
                </li>
                <li className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs">3</span>
                  Tap <b className="text-white">Add</b> — PulseMeet appears on your home screen
                </li>
              </ol>
              <p className="mt-4 text-xs text-white/40">
                Note: iOS only supports this in <b>Safari</b> (not Chrome).
              </p>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
