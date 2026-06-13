"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
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
