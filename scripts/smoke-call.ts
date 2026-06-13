/**
 * Smoke test for the call layer:
 *  1. LiveKit credentials/server reachable (RoomServiceClient.listRooms).
 *  2. A LiveKit access token mints and decodes with the right room grant.
 *  3. call:invite over the socket is delivered as call:incoming to the peer.
 *
 *   pnpm exec tsx scripts/smoke-call.ts
 */
import { io } from "socket.io-client";
import bcrypt from "bcryptjs";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { prisma } from "@/lib/prisma";
import { createSocketToken } from "@/lib/socket-token";
import type { CallInvite } from "@/lib/realtime-events";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3100";
const LK_WS = process.env.NEXT_PUBLIC_LIVEKIT_URL || "ws://localhost:7880";
const LK_HTTP = LK_WS.replace(/^ws/, "http");
const KEY = process.env.LIVEKIT_API_KEY || "devkey";
const SECRET = process.env.LIVEKIT_API_SECRET || "secret";

async function ensureUser(email: string, name: string) {
  const passwordHash = await bcrypt.hash("password123", 10);
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name, passwordHash },
  });
}

async function main() {
  // 1. LiveKit server reachable with our credentials.
  const svc = new RoomServiceClient(LK_HTTP, KEY, SECRET);
  const rooms = await svc.listRooms();
  console.log(`✅ LiveKit reachable at ${LK_HTTP} (${rooms.length} active rooms)`);

  // 2. Token mints and carries the room grant.
  const at = new AccessToken(KEY, SECRET, { identity: "tester", name: "Tester" });
  at.addGrant({ room: "demo-room", roomJoin: true, canPublish: true, canSubscribe: true });
  const jwt = await at.toJwt();
  const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString());
  if (payload.video?.room !== "demo-room" || !payload.video?.roomJoin) {
    throw new Error("token grant missing expected room/roomJoin");
  }
  console.log("✅ LiveKit access token mints with correct grant");

  // 3. call:invite signaling reaches the peer.
  const alice = await ensureUser("alice@smoke.test", "Alice Smoke");
  const bob = await ensureUser("bob@smoke.test", "Bob Smoke");
  let convo = await prisma.conversation.findFirst({
    where: {
      type: "DIRECT",
      AND: [
        { members: { some: { userId: alice.id } } },
        { members: { some: { userId: bob.id } } },
      ],
    },
  });
  if (!convo) {
    convo = await prisma.conversation.create({
      data: { type: "DIRECT", members: { create: [{ userId: alice.id }, { userId: bob.id }] } },
    });
  }

  const aliceSock = io(APP_URL, { auth: { token: createSocketToken(alice.id) } });
  const bobSock = io(APP_URL, { auth: { token: createSocketToken(bob.id) } });

  const gotInvite = new Promise<CallInvite>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timed out waiting for call:incoming")), 8000);
    bobSock.on("call:incoming", (invite: CallInvite) => {
      clearTimeout(timer);
      resolve(invite);
    });
  });

  await Promise.all([
    new Promise<void>((r) => aliceSock.on("connect", () => r())),
    new Promise<void>((r) => bobSock.on("connect", () => r())),
  ]);
  await new Promise((r) => setTimeout(r, 300));

  aliceSock.emit("call:invite", { conversationId: convo.id, withVideo: true });

  const invite = await gotInvite;
  if (invite.from.id !== alice.id || !invite.withVideo) {
    throw new Error("invite payload incorrect: " + JSON.stringify(invite));
  }
  console.log(`✅ Bob received call:incoming from ${invite.from.name} (video=${invite.withVideo})`);

  aliceSock.disconnect();
  bobSock.disconnect();
  await prisma.$disconnect();
  console.log("\n🎉 Call layer smoke test PASSED");
  process.exit(0);
}

main().catch(async (err) => {
  console.error("❌ Call smoke test FAILED:", err.message);
  await prisma.$disconnect();
  process.exit(1);
});
