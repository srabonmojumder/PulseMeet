import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getConversationForUser } from "@/lib/queries";
import { CallRoom } from "@/components/call-room";

export default async function CallPage({
  params,
  searchParams,
}: {
  params: Promise<{ conversationId: string }>;
  searchParams: Promise<{ video?: string }>;
}) {
  const { conversationId } = await params;
  const { video } = await searchParams;
  const session = await auth();

  // Authorize: must be a member of the conversation.
  const conversation = await getConversationForUser(conversationId, session!.user.id);
  if (!conversation) notFound();

  return <CallRoom conversationId={conversationId} withVideo={video !== "0"} />;
}
