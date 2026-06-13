import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getConversationForUser } from "@/lib/queries";
import { MessageThread } from "@/components/message-thread";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  const session = await auth();
  const userId = session!.user.id;

  const conversation = await getConversationForUser(conversationId, userId);
  if (!conversation) notFound();

  const title = conversation.otherUser?.name ?? conversation.name ?? "Conversation";

  return (
    <MessageThread
      conversationId={conversation.id}
      title={title}
      otherUserId={conversation.otherUser?.id ?? null}
      otherUserImage={conversation.otherUser?.image ?? null}
      currentUserId={userId}
      initialMessages={conversation.messages}
    />
  );
}
