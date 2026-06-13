"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const profileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  bio: z.string().trim().max(300).optional(),
  image: z.string().max(2048).nullable().optional(),
});

export async function updateProfile(input: {
  name: string;
  bio?: string;
  image?: string | null;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { name, bio, image } = parsed.data;
  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { name, bio: bio ?? null, image: image ?? null },
    select: { name: true, bio: true, image: true },
  });

  revalidatePath("/chat");
  revalidatePath("/settings");
  return { ok: true, user };
}
