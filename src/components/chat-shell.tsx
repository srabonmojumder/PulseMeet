"use client";

import { useParams } from "next/navigation";

// Responsive two-pane shell: on mobile we show EITHER the conversation list or
// the open thread (not both); on >= sm both panes are visible side by side.
export function ChatShell({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  const params = useParams<{ conversationId?: string }>();
  const threadOpen = Boolean(params?.conversationId);

  return (
    <>
      {/* Wrapper is a flex container that fills the row's height, so the sidebar
          <aside> inside stretches to full height (matching the main pane). */}
      <div
        className={`min-h-0 w-full sm:w-80 sm:shrink-0 ${
          threadOpen ? "hidden sm:flex" : "flex"
        }`}
      >
        {sidebar}
      </div>
      <main
        className={`glass min-h-0 min-w-0 flex-1 flex-col overflow-hidden sm:flex sm:rounded-2xl ${
          threadOpen ? "flex" : "hidden"
        }`}
      >
        {children}
      </main>
    </>
  );
}
