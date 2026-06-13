/**
 * Group chat smoke test: create a 3-person group, have all join, send one
 * message and assert BOTH other members receive it live.
 *   pnpm exec tsx scripts/smoke-group.ts
 */
import { io } from "socket.io-client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSocketToken } from "@/lib/socket-token";
import type { MessageDTO } from "@/lib/realtime-events";

const URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3100";

async function ensure(email: string, name: string) {
  const passwordHash = await bcrypt.hash("password123", 10);
  return prisma.user.upsert({ where: { email }, update: {}, create: { email, name, passwordHash } });
}

async function main() {
  const a = await ensure("alice@smoke.test", "Alice");
  const b = await ensure("bob@smoke.test", "Bob");
  const c = await ensure("charlie@pulsemeet.test", "Charlie");

  const group = await prisma.conversation.create({
    data: {
      type: "GROUP",
      name: "Smoke Group",
      members: { create: [{ userId: a.id }, { userId: b.id }, { userId: c.id }] },
    },
  });
  console.log("✅ Group created:", group.id);

  const sa = io(URL, { auth: { token: createSocketToken(a.id) } });
  const sb = io(URL, { auth: { token: createSocketToken(b.id) } });
  const sc = io(URL, { auth: { token: createSocketToken(c.id) } });

  const text = `group hi @ ${new Date().toISOString()}`;
  const gotB = new Promise<MessageDTO>((res, rej) => {
    const t = setTimeout(() => rej(new Error("Bob timeout")), 8000);
    sb.on("message:new", (m: MessageDTO) => m.content === text && (clearTimeout(t), res(m)));
  });
  const gotC = new Promise<MessageDTO>((res, rej) => {
    const t = setTimeout(() => rej(new Error("Charlie timeout")), 8000);
    sc.on("message:new", (m: MessageDTO) => m.content === text && (clearTimeout(t), res(m)));
  });

  await Promise.all([
    new Promise<void>((r) => sa.on("connect", () => r())),
    new Promise<void>((r) => sb.on("connect", () => r())),
    new Promise<void>((r) => sc.on("connect", () => r())),
  ]);
  sb.emit("conversation:join", group.id);
  sc.emit("conversation:join", group.id);
  await new Promise((r) => setTimeout(r, 2500)); // allow joins to finish (Neon can be cold)

  sa.emit("message:send", { conversationId: group.id, content: text });

  await Promise.all([gotB, gotC]);
  console.log("✅ Both Bob and Charlie received the group message");

  // cleanup this test group
  await prisma.conversation.delete({ where: { id: group.id } });
  sa.disconnect(); sb.disconnect(); sc.disconnect();
  await prisma.$disconnect();
  console.log("\n🎉 Group chat smoke test PASSED");
  process.exit(0);
}

main().catch(async (e) => {
  console.error("❌ Group smoke FAILED:", e.message);
  await prisma.$disconnect();
  process.exit(1);
});
