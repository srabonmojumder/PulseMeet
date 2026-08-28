import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { messageInclude, toMessageDTO, visibleMessageWhere } from "@/lib/queries";

const attachmentSchema = z.object({
  url: z.string().min(1).max(1024),
  name: z.string().min(1).max(255),
  contentType: z.string().max(255),
  size: z.number().int().nonnegative(),
});

const sendSchema = z
  .object({
    conversationId: z.string().min(1),
    content: z.string().trim().max(4000),
    attachments: z.array(attachmentSchema).max(10).optional(),
    replyToId: z.string().min(1).optional(),
    expireSeconds: z.number().int().positive().max(7 * 24 * 60 * 60).optional(),
    scheduleSeconds: z.number().int().positive().max(30 * 24 * 60 * 60).optional(),
  })
  .refine((d) => d.content.length > 0 || (d.attachments?.length ?? 0) > 0, {
    message: "Empty message",
  });

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get("conversationId");
  if (!conversationId) {
    return NextResponse.json({ error: "conversationId is required" }, { status: 400 });
  }

  const isMember = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: session.user.id } },
    select: { id: true },
  });

  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const since = searchParams.get("since");
  const where: any = {
    conversationId,
    ...visibleMessageWhere(session.user.id, new Date()),
  };
  if (since) {
    where.createdAt = { gt: new Date(since) };
  }

  const messages = await prisma.message.findMany({
    where,
    orderBy: { createdAt: "asc" },
    take: 100,
    include: messageInclude,
  });

  return NextResponse.json({ messages: messages.map(toMessageDTO) });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { conversationId, content, attachments, replyToId, expireSeconds, scheduleSeconds } =
    parsed.data;
  const userId = session.user.id;

  const isMember = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { id: true },
  });

  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let validReplyId: string | undefined;
  if (replyToId) {
    const parent = await prisma.message.findFirst({
      where: { id: replyToId, conversationId },
      select: { id: true },
    });
    validReplyId = parent?.id;
  }

  const now = Date.now();
  const expiresAt = expireSeconds ? new Date(now + expireSeconds * 1000) : null;
  const scheduledFor = scheduleSeconds ? new Date(now + scheduleSeconds * 1000) : null;

  try {
    const created = await prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        content,
        replyToId: validReplyId,
        expiresAt,
        scheduledFor,
        createdAt: scheduledFor ?? undefined,
        attachments: attachments?.length ? { create: attachments } : undefined,
      },
      include: messageInclude,
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    const dto = toMessageDTO(created);
    return NextResponse.json({ message: dto }, { status: 201 });
  } catch (err: unknown) {
    console.error("Message send error:", err);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { messageId, content } = body;
  const text = typeof content === "string" ? content.trim() : "";
  if (!messageId || !text || text.length > 4000) {
    return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  }

  const msg = await prisma.message.findUnique({
    where: { id: messageId },
    select: { senderId: true, conversationId: true, deletedAt: true },
  });

  if (!msg || msg.deletedAt || msg.senderId !== session.user.id) {
    return NextResponse.json({ error: "Not found or not permitted" }, { status: 403 });
  }

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { content: text, editedAt: new Date() },
    include: messageInclude,
  });

  return NextResponse.json({ message: toMessageDTO(updated) });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const messageId = searchParams.get("messageId");
  if (!messageId) {
    return NextResponse.json({ error: "messageId is required" }, { status: 400 });
  }

  const msg = await prisma.message.findUnique({
    where: { id: messageId },
    select: { senderId: true, conversationId: true, deletedAt: true },
  });

  if (!msg || msg.senderId !== session.user.id) {
    return NextResponse.json({ error: "Not found or not permitted" }, { status: 403 });
  }

  await prisma.message.update({
    where: { id: messageId },
    data: {
      deletedAt: new Date(),
      attachments: { deleteMany: {} },
      reactions: { deleteMany: {} },
    },
  });

  return NextResponse.json({ ok: true });
}
