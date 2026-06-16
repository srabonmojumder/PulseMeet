import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { MessageDTO } from "@/lib/realtime-events";

/** Everything needed to build a MessageDTO in one query — shared by the loader
 *  and the realtime server so both shapes stay identical. */
export const messageInclude = {
  sender: { select: { id: true, name: true, image: true } },
  attachments: { select: { url: true, name: true, contentType: true, size: true } },
  reactions: { select: { emoji: true, userId: true, user: { select: { name: true } } } },
  replyTo: {
    select: {
      id: true,
      content: true,
      deletedAt: true,
      sender: { select: { name: true } },
      attachments: { select: { id: true } },
    },
  },
} satisfies Prisma.MessageInclude;

type MessageWithRelations = Prisma.MessageGetPayload<{ include: typeof messageInclude }>;

/** Hide a soft-deleted message's content/attachments while keeping it in the thread. */
export function toMessageDTO(m: MessageWithRelations): MessageDTO {
  const deleted = Boolean(m.deletedAt);
  return {
    id: m.id,
    conversationId: m.conversationId,
    content: deleted ? "" : m.content,
    createdAt: m.createdAt.toISOString(),
    sender: m.sender,
    attachments: deleted ? [] : m.attachments,
    reactions: deleted
      ? []
      : m.reactions.map((r) => ({ emoji: r.emoji, userId: r.userId, name: r.user.name })),
    replyTo: m.replyTo
      ? {
          id: m.replyTo.id,
          senderName: m.replyTo.sender.name,
          content: m.replyTo.deletedAt ? "" : m.replyTo.content,
          hasAttachments: m.replyTo.attachments.length > 0,
        }
      : null,
    editedAt: m.editedAt ? m.editedAt.toISOString() : null,
    deletedAt: m.deletedAt ? m.deletedAt.toISOString() : null,
    expiresAt: m.expiresAt ? m.expiresAt.toISOString() : null,
    pinnedAt: m.pinnedAt ? m.pinnedAt.toISOString() : null,
    scheduledFor: m.scheduledFor ? m.scheduledFor.toISOString() : null,
  };
}

/** Message visibility filter shared by loaders: skip disappeared messages and
 *  scheduled messages that haven't been delivered yet (sender still sees own). */
export function visibleMessageWhere(userId: string, now: Date): Prisma.MessageWhereInput {
  return {
    AND: [
      { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      { OR: [{ scheduledFor: null }, { deliveredAt: { not: null } }, { senderId: userId }] },
    ],
  };
}

export interface ConversationListItem {
  id: string;
  type: string;
  name: string | null;
  /** The "other" participant for DIRECT conversations. */
  otherUser: { id: string; name: string; image: string | null } | null;
  memberCount: number;
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
        // Don't preview deleted, expired, or not-yet-delivered messages.
        where: { deletedAt: null, ...visibleMessageWhere(userId, new Date()) },
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
      memberCount: c.members.length,
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
    where: { conversationId, ...visibleMessageWhere(userId, new Date()) },
    orderBy: { createdAt: "asc" },
    take: 100,
    include: messageInclude,
  });

  const otherUser = conversation.members.find((m) => m.userId !== userId)?.user ?? null;
  const members = conversation.members.map((m) => m.user);
  // Read receipts: when each *other* member last read this conversation.
  const memberReads = conversation.members
    .filter((m) => m.userId !== userId)
    .map((m) => ({ userId: m.userId, lastReadAt: m.lastReadAt?.toISOString() ?? null }));

  return {
    id: conversation.id,
    type: conversation.type,
    name: conversation.name,
    otherUser,
    members,
    memberCount: members.length,
    memberReads,
    messages: messages.map(toMessageDTO),
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

  // Guard against stale references (e.g. a session whose User row was removed)
  // so we fail with a clear message instead of a raw foreign-key violation.
  const found = await prisma.user.count({ where: { id: { in: [userId, otherUserId] } } });
  if (found < 2) throw new Error("One of the participants no longer exists");

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
