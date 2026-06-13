"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  getOrCreateDirectConversation,
  searchUsers as searchUsersQuery,
} from "@/lib/queries";

export async function startDirectConversation(otherUserId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const conversationId = await getOrCreateDirectConversation(
    session.user.id,
    otherUserId,
  );
  revalidatePath("/chat");
  redirect(`/chat/${conversationId}`);
}

export async function searchUsers(query: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return searchUsersQuery(query, session.user.id);
}

export async function createGroupConversation(name: string, memberIds: string[]) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const trimmed = name.trim();
  if (!trimmed) return { error: "Group name is required" };

  // Unique member ids, always include the creator.
  const ids = Array.from(new Set([session.user.id, ...memberIds]));
  if (ids.length < 3) return { error: "Pick at least 2 people for a group" };

  const created = await prisma.conversation.create({
    data: {
      type: "GROUP",
      name: trimmed,
      members: { create: ids.map((userId) => ({ userId })) },
    },
    select: { id: true },
  });

  revalidatePath("/chat");
  return { id: created.id };
}
