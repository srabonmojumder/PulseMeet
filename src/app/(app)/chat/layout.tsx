import { auth } from "@/auth";
import { getConversationsForUser } from "@/lib/queries";
import { Sidebar } from "@/components/sidebar";

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const userId = session!.user.id;
  const conversations = await getConversationsForUser(userId);

  return (
    <>
      <Sidebar conversations={conversations} currentUserId={userId} />
      <main className="glass flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden sm:rounded-2xl">
        {children}
      </main>
    </>
  );
}
