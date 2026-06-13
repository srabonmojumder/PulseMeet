/**
 * End-to-end realtime smoke test.
 * Creates two users + a DIRECT conversation, connects two authenticated
 * socket clients, sends a message from A and asserts B receives it live.
 *
 *   pnpm exec tsx scripts/smoke-realtime.ts
 */
import { io } from "socket.io-client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSocketToken } from "@/lib/socket-token";
import type { MessageDTO } from "@/lib/realtime-events";

const URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3100";

async function ensureUser(email: string, name: string) {
  const passwordHash = await bcrypt.hash("password123", 10);
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name, passwordHash },
  });
}

async function main() {
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
      data: {
        type: "DIRECT",
        members: { create: [{ userId: alice.id }, { userId: bob.id }] },
      },
    });
  }
  const conversationId = convo.id;

  const aliceSock = io(URL, { auth: { token: createSocketToken(alice.id) } });
  const bobSock = io(URL, { auth: { token: createSocketToken(bob.id) } });

  const text = `hello from alice @ ${new Date().toISOString()}`;

  const received = new Promise<MessageDTO>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timed out waiting for message:new")), 8000);
    bobSock.on("message:new", (msg: MessageDTO) => {
      if (msg.content === text) {
        clearTimeout(timer);
        resolve(msg);
      }
    });
    bobSock.on("connect_error", (e) => reject(new Error("bob connect_error: " + e.message)));
    aliceSock.on("connect_error", (e) => reject(new Error("alice connect_error: " + e.message)));
  });

  await Promise.all([
    new Promise<void>((r) => aliceSock.on("connect", () => r())),
    new Promise<void>((r) => bobSock.on("connect", () => r())),
  ]);

  bobSock.emit("conversation:join", conversationId);
  aliceSock.emit("conversation:join", conversationId);
  await new Promise((r) => setTimeout(r, 300));

  aliceSock.emit("message:send", { conversationId, content: text });

  const msg = await received;
  console.log("✅ Bob received message from Alice:", msg.content);
  console.log("   sender:", msg.sender.name, "| id:", msg.id);

  // Verify persistence.
  const persisted = await prisma.message.findUnique({ where: { id: msg.id } });
  if (!persisted) throw new Error("message not persisted to DB");
  console.log("✅ Message persisted to database");

  aliceSock.disconnect();
  bobSock.disconnect();
  await prisma.$disconnect();
  console.log("\n🎉 Realtime chat smoke test PASSED");
  process.exit(0);
}

main().catch(async (err) => {
  console.error("❌ Smoke test FAILED:", err.message);
  await prisma.$disconnect();
  process.exit(1);
});
