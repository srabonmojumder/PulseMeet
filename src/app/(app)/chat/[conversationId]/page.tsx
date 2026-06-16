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

  const isGroup = conversation.type === "GROUP";
  const title = isGroup
    ? conversation.name ?? "Group"
    : conversation.otherUser?.name ?? "Conversation";

  return (
    <MessageThread
      key={conversation.id}
      conversationId={conversation.id}
      title={title}
      isGroup={isGroup}
      memberCount={conversation.memberCount}
      otherUserId={conversation.otherUser?.id ?? null}
      otherUserImage={conversation.otherUser?.image ?? null}
      currentUserId={userId}
      initialMessages={conversation.messages}
      initialReads={conversation.memberReads}
    />
  );
}
