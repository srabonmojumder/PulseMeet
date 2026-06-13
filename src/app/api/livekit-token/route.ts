import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { AccessToken } from "livekit-server-sdk";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Mints a LiveKit access token for a conversation's call room.
// The room name is the conversation id; only members may join.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get("room");
  if (!conversationId) {
    return NextResponse.json({ error: "Missing room" }, { status: 400 });
  }

  const member = await prisma.conversationMember.findUnique({
    where: {
      conversationId_userId: { conversationId, userId: session.user.id },
    },
    select: { id: true },
  });
  if (!member) {
    return NextResponse.json({ error: "Not a member of this conversation" }, { status: 403 });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const url = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  if (!apiKey || !apiSecret || !url) {
    return NextResponse.json({ error: "LiveKit not configured" }, { status: 500 });
  }

  // Unique identity per connection so the same user can join from multiple
  // devices/tabs without LiveKit kicking the earlier session (duplicate
  // identity). The display name still shows who they are.
  const at = new AccessToken(apiKey, apiSecret, {
    identity: `${session.user.id}__${randomUUID().slice(0, 8)}`,
    name: session.user.name ?? "User",
    ttl: "2h",
  });
  at.addGrant({
    room: conversationId,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  const token = await at.toJwt();
  return NextResponse.json({ token, url });
}
