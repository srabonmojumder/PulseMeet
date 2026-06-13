import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const MAX_BYTES = 3 * 1024 * 1024; // 3 MB for an avatar

// Stores the user's profile photo IN THE DATABASE (so it survives redeploys on
// hosts with ephemeral disks) and points User.image at the serving route.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Please choose an image" }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be under 3 MB" }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      avatarData: bytes,
      avatarType: file.type,
      image: `/api/avatar/${session.user.id}?v=${Date.now()}`,
    },
  });

  return NextResponse.json({
    url: `/api/avatar/${session.user.id}?v=${Date.now()}`,
  });
}
