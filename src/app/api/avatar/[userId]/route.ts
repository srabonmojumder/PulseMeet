import { prisma } from "@/lib/prisma";

// Serves a user's profile photo from the database.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarData: true, avatarType: true },
  });

  if (!user?.avatarData) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(Buffer.from(user.avatarData), {
    headers: {
      "Content-Type": user.avatarType ?? "image/jpeg",
      // Cache aggressively; the ?v=timestamp query busts it on change.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
