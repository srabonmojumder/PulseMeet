import { auth } from "@/auth";
import { getConversationsForUser } from "@/lib/queries";
import { Sidebar } from "@/components/sidebar";
import { ChatShell } from "@/components/chat-shell";

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const userId = session!.user.id;
  const conversations = await getConversationsForUser(userId);

  return (
    <ChatShell sidebar={<Sidebar conversations={conversations} currentUserId={userId} />}>
      {children}
    </ChatShell>
  );
}
