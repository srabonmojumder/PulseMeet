"use client";

import { useEffect, useState } from "react";
import { Download, Share, X, MoreVertical } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Capture beforeinstallprompt as early as the module loads, so we don't miss it
// if it fires before the component mounts.
let earlyPrompt: BeforeInstallPromptEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    earlyPrompt = e as BeforeInstallPromptEvent;
  });
}

type Platform = "android" | "ios" | "other";

// Surfaces an install affordance on every platform:
// - Native prompt (Android / desktop Chrome/Edge) when available.
// - Otherwise platform-specific instructions (iOS Safari, Android menu).
export function InstallButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<Platform>("other");
  const [standalone, setStandalone] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent;
    const ios =
      /iphone|ipad|ipod/i.test(ua) ||
      (ua.includes("Mac") && navigator.maxTouchPoints > 1);
    setPlatform(ios ? "ios" : /android/i.test(ua) ? "android" : "other");
    setStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        // @ts-expect-error iOS Safari only
        window.navigator.standalone === true,
    );

    if (earlyPrompt) setDeferred(earlyPrompt);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setStandalone(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Already installed → nothing to show.
  if (standalone) return null;

  async function onClick() {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
      return;
    }
    setShowHelp(true);
  }

  return (
    <>
      <button
        onClick={onClick}
        className="flex items-center gap-1.5 rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-3 py-1.5 text-sm font-medium text-indigo-300 transition hover:bg-indigo-500/20"
      >
        <Download size={15} /> Install
      </button>

      {showHelp && (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="pm-rise w-full max-w-sm rounded-2xl border border-white/10 bg-[#15151f] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-white">Install PulseMeet</h3>
              <button onClick={() => setShowHelp(false)} className="text-white/40 hover:text-white">
                <X size={18} />
              </button>
            </div>

            {platform === "ios" ? (
              <ol className="space-y-3 text-sm text-white/70">
                <Step n={1}>
                  Tap the <Share size={15} className="inline text-indigo-300" /> <b className="text-white">Share</b> button in Safari
                </Step>
                <Step n={2}>
                  Scroll and tap <b className="text-white">“Add to Home Screen”</b>
                </Step>
                <Step n={3}>
                  Tap <b className="text-white">Add</b> — done!
                </Step>
                <li className="pt-1 text-xs text-white/40">iOS supports this only in <b>Safari</b>.</li>
              </ol>
            ) : (
              <ol className="space-y-3 text-sm text-white/70">
                <Step n={1}>
                  Open the browser menu <MoreVertical size={15} className="inline text-indigo-300" /> (top-right in Chrome)
                </Step>
                <Step n={2}>
                  Tap <b className="text-white">“Install app”</b> or <b className="text-white">“Add to Home screen”</b>
                </Step>
                <Step n={3}>
                  Confirm <b className="text-white">Install</b> — done!
                </Step>
                <li className="pt-1 text-xs text-white/40">Use <b>Chrome</b> for the best install experience.</li>
              </ol>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}
