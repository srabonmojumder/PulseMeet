import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { lastSeenAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed to update presence" }, { status: 500 });
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Users active within the last 30 seconds
    const cutoff = new Date(Date.now() - 30_000);
    const activeUsers = await prisma.user.findMany({
      where: {
        lastSeenAt: { gte: cutoff },
      },
      select: { id: true },
    });

    return NextResponse.json({
      onlineUsers: activeUsers.map((u) => u.id),
    });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch presence" }, { status: 500 });
  }
}
