import { prisma } from "@/lib/prisma";

export interface ConversationListItem {
  id: string;
  type: string;
  name: string | null;
  /** The "other" participant for DIRECT conversations. */
  otherUser: { id: string; name: string; image: string | null } | null;
  lastMessage: { content: string; createdAt: string; senderId: string } | null;
  updatedAt: string;
}

export async function getConversationsForUser(
  userId: string,
): Promise<ConversationListItem[]> {
  const conversations = await prisma.conversation.findMany({
    where: { members: { some: { userId } } },
    orderBy: { updatedAt: "desc" },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, image: true } } },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true, createdAt: true, senderId: true },
      },
    },
  });

  return conversations.map((c) => {
    const other = c.members.find((m) => m.userId !== userId)?.user ?? null;
    const last = c.messages[0];
    return {
      id: c.id,
      type: c.type,
      name: c.name,
      otherUser: other,
      lastMessage: last
        ? {
            content: last.content,
            createdAt: last.createdAt.toISOString(),
            senderId: last.senderId,
          }
        : null,
      updatedAt: c.updatedAt.toISOString(),
    };
  });
}

export async function getConversationForUser(conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, members: { some: { userId } } },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, image: true } } },
      },
    },
  });
  if (!conversation) return null;

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: 100,
    include: { sender: { select: { id: true, name: true, image: true } } },
  });

  const otherUser = conversation.members.find((m) => m.userId !== userId)?.user ?? null;

  return {
    id: conversation.id,
    type: conversation.type,
    name: conversation.name,
    otherUser,
    messages: messages.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
      sender: m.sender,
    })),
  };
}

/** Find an existing 1:1 conversation between two users, or create one. */
export async function getOrCreateDirectConversation(userId: string, otherUserId: string) {
  if (userId === otherUserId) throw new Error("Cannot start a conversation with yourself");

  const existing = await prisma.conversation.findFirst({
    where: {
      type: "DIRECT",
      AND: [
        { members: { some: { userId } } },
        { members: { some: { userId: otherUserId } } },
      ],
    },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.conversation.create({
    data: {
      type: "DIRECT",
      members: { create: [{ userId }, { userId: otherUserId }] },
    },
    select: { id: true },
  });
  return created.id;
}

export async function searchUsers(query: string, excludeUserId: string) {
  const q = query.trim();
  return prisma.user.findMany({
    where: {
      id: { not: excludeUserId },
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { email: { contains: q } },
            ],
          }
        : {}),
    },
    select: { id: true, name: true, email: true, image: true },
    orderBy: { name: "asc" },
    take: 20,
  });
}
