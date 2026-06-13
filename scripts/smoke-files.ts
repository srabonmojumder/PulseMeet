/**
 * Smoke test for file sharing: send a message carrying an attachment over the
 * socket, assert the peer receives it and the attachment is persisted.
 *
 *   pnpm exec tsx scripts/smoke-files.ts
 */
import { io } from "socket.io-client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSocketToken } from "@/lib/socket-token";
import type { MessageDTO } from "@/lib/realtime-events";

const URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3100";

async function ensureUser(email: string, name: string) {
  const passwordHash = await bcrypt.hash("password123", 10);
  return prisma.user.upsert({ where: { email }, update: {}, create: { email, name, passwordHash } });
}

async function main() {
  const alice = await ensureUser("alice@smoke.test", "Alice Smoke");
  const bob = await ensureUser("bob@smoke.test", "Bob Smoke");
  let convo = await prisma.conversation.findFirst({
    where: {
      type: "DIRECT",
      AND: [{ members: { some: { userId: alice.id } } }, { members: { some: { userId: bob.id } } }],
    },
  });
  if (!convo) {
    convo = await prisma.conversation.create({
      data: { type: "DIRECT", members: { create: [{ userId: alice.id }, { userId: bob.id }] } },
    });
  }

  const aliceSock = io(URL, { auth: { token: createSocketToken(alice.id) } });
  const bobSock = io(URL, { auth: { token: createSocketToken(bob.id) } });

  const fileName = `report-${Date.now()}.pdf`;
  const attachment = {
    url: "/uploads/test-fixture.pdf",
    name: fileName,
    contentType: "application/pdf",
    size: 12345,
  };

  const received = new Promise<MessageDTO>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timed out")), 8000);
    bobSock.on("message:new", (m: MessageDTO) => {
      if (m.attachments.some((a) => a.name === fileName)) {
        clearTimeout(t);
        resolve(m);
      }
    });
  });

  await Promise.all([
    new Promise<void>((r) => aliceSock.on("connect", () => r())),
    new Promise<void>((r) => bobSock.on("connect", () => r())),
  ]);
  bobSock.emit("conversation:join", convo.id);
  await new Promise((r) => setTimeout(r, 300));

  // Attachment-only message (empty text) — exercises the refine() rule too.
  aliceSock.emit("message:send", { conversationId: convo.id, content: "", attachments: [attachment] });

  const msg = await received;
  console.log(`✅ Bob received message with attachment: ${msg.attachments[0].name}`);

  const persisted = await prisma.attachment.findFirst({ where: { name: fileName } });
  if (!persisted || persisted.url !== attachment.url) throw new Error("attachment not persisted");
  console.log("✅ Attachment persisted to database");

  aliceSock.disconnect();
  bobSock.disconnect();
  await prisma.$disconnect();
  console.log("\n🎉 File sharing smoke test PASSED");
  process.exit(0);
}

main().catch(async (err) => {
  console.error("❌ File smoke test FAILED:", err.message);
  await prisma.$disconnect();
  process.exit(1);
});
