import type { Server, Socket } from "socket.io";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { messageInclude, toMessageDTO } from "@/lib/queries";
import { verifySocketToken } from "@/lib/socket-token";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from "@/lib/realtime-events";

type AppServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const roomFor = (conversationId: string) => `conv:${conversationId}`;
const userRoom = (userId: string) => `user:${userId}`;

const attachmentSchema = z.object({
  url: z.string().min(1).max(1024),
  name: z.string().min(1).max(255),
  contentType: z.string().max(255),
  size: z.number().int().nonnegative(),
});

const MAX_EXPIRE_SECONDS = 7 * 24 * 60 * 60; // a disappearing message lasts at most a week

const sendSchema = z
  .object({
    conversationId: z.string().min(1),
    content: z.string().trim().max(4000),
    attachments: z.array(attachmentSchema).max(10).optional(),
    replyToId: z.string().min(1).optional(),
    expireSeconds: z.number().int().positive().max(MAX_EXPIRE_SECONDS).optional(),
  })
  // A message must carry text, attachments, or both.
  .refine((d) => d.content.length > 0 || (d.attachments?.length ?? 0) > 0, {
    message: "Empty message",
  });

// userId -> count of live sockets (for presence).
const presence = new Map<string, number>();

// conversationId -> (userId -> name) actively viewing it right now (co-presence).
const activeViewers = new Map<string, Map<string, string>>();

function setActive(conversationId: string, userId: string, name: string, active: boolean) {
  let map = activeViewers.get(conversationId);
  if (!map) {
    map = new Map();
    activeViewers.set(conversationId, map);
  }
  if (active) map.set(userId, name);
  else map.delete(userId);
  if (map.size === 0) activeViewers.delete(conversationId);
}

async function isMember(userId: string, conversationId: string): Promise<boolean> {
  const member = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { id: true },
  });
  return Boolean(member);
}

/** Re-read a message with all its relations and broadcast the fresh DTO so every
 *  open client replaces its copy (used for edits, deletes, and reaction changes). */
async function emitMessageUpdate(io: AppServer, conversationId: string, messageId: string) {
  const m = await prisma.message.findUnique({ where: { id: messageId }, include: messageInclude });
  if (m) io.to(roomFor(conversationId)).emit("message:update", toMessageDTO(m));
}

export function attachRealtime(io: AppServer) {
  // Authenticate every connection with the short-lived signed token.
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    const verified = token ? verifySocketToken(token) : null;
    if (!verified) return next(new Error("unauthorized"));

    const user = await prisma.user.findUnique({
      where: { id: verified.userId },
      select: { id: true, name: true },
    });
    if (!user) return next(new Error("unauthorized"));

    socket.data.userId = user.id;
    socket.data.name = user.name;
    next();
  });

  io.on("connection", (socket: AppSocket) => {
    const { userId, name } = socket.data;

    // Personal room: lets us reach a user (e.g. call invites) regardless of
    // which conversation they currently have open.
    socket.join(userRoom(userId));

    // Track presence and announce coming online (first socket only).
    const prev = presence.get(userId) ?? 0;
    presence.set(userId, prev + 1);
    if (prev === 0) io.emit("presence", { userId, online: true });

    // Conversations this socket is actively viewing (for co-presence cleanup).
    const activeConvos = new Set<string>();

    socket.on("convo:active", async ({ conversationId, active }) => {
      if (typeof conversationId !== "string") return;
      if (active && !(await isMember(userId, conversationId))) return;

      if (active) {
        // Tell me who's already here (before adding myself).
        const here = activeViewers.get(conversationId);
        if (here) {
          for (const [otherId, otherName] of here) {
            if (otherId === userId) continue;
            socket.emit("convo:presence", {
              conversationId,
              userId: otherId,
              name: otherName,
              active: true,
            });
          }
        }
        activeConvos.add(conversationId);
        setActive(conversationId, userId, name, true);
        // …and tell the room I'm here.
        socket.to(roomFor(conversationId)).emit("convo:presence", {
          conversationId,
          userId,
          name,
          active: true,
        });
      } else {
        activeConvos.delete(conversationId);
        setActive(conversationId, userId, name, false);
        socket.to(roomFor(conversationId)).emit("convo:presence", {
          conversationId,
          userId,
          name,
          active: false,
        });
      }
    });

    socket.on("reaction:fly", async ({ conversationId, emoji }) => {
      if (typeof conversationId !== "string" || typeof emoji !== "string") return;
      if (!(await isMember(userId, conversationId))) return;
      socket.to(roomFor(conversationId)).emit("reaction:fly", {
        conversationId,
        userId,
        name,
        emoji: emoji.slice(0, 8),
      });
    });

    socket.on("conversation:join", async (conversationId) => {
      if (typeof conversationId !== "string") return;
      if (!(await isMember(userId, conversationId))) {
        socket.emit("error", "You are not a member of this conversation");
        return;
      }
      socket.join(roomFor(conversationId));
    });

    socket.on("conversation:leave", (conversationId) => {
      if (typeof conversationId === "string") socket.leave(roomFor(conversationId));
    });

    socket.on("message:send", async (raw, ack) => {
      const parsed = sendSchema.safeParse(raw);
      if (!parsed.success) {
        ack?.({ ok: false, error: "Invalid message" });
        return;
      }
      const { conversationId, content, attachments, replyToId, expireSeconds } = parsed.data;

      if (!(await isMember(userId, conversationId))) {
        ack?.({ ok: false, error: "Not a member of this conversation" });
        return;
      }

      // A reply must point at a message in the same conversation.
      let validReplyId: string | undefined;
      if (replyToId) {
        const parent = await prisma.message.findFirst({
          where: { id: replyToId, conversationId },
          select: { id: true },
        });
        validReplyId = parent?.id;
      }

      const expiresAt = expireSeconds
        ? new Date(Date.now() + expireSeconds * 1000)
        : null;

      const created = await prisma.message.create({
        data: {
          conversationId,
          senderId: userId,
          content,
          replyToId: validReplyId,
          expiresAt,
          attachments: attachments?.length ? { create: attachments } : undefined,
        },
        include: messageInclude,
      });
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      const dto = toMessageDTO(created);
      io.to(roomFor(conversationId)).emit("message:new", dto);
      ack?.({ ok: true, message: dto });
    });

    // Toggle an emoji reaction on a message (add if absent, remove if present).
    socket.on("reaction:toggle", async ({ messageId, emoji }) => {
      if (typeof messageId !== "string" || typeof emoji !== "string") return;
      const e = emoji.slice(0, 16);
      if (!e) return;
      const msg = await prisma.message.findUnique({
        where: { id: messageId },
        select: { conversationId: true, deletedAt: true },
      });
      if (!msg || msg.deletedAt) return;
      if (!(await isMember(userId, msg.conversationId))) return;

      const existing = await prisma.reaction.findUnique({
        where: { messageId_userId_emoji: { messageId, userId, emoji: e } },
        select: { id: true },
      });
      if (existing) {
        await prisma.reaction.delete({ where: { id: existing.id } });
      } else {
        await prisma.reaction.create({ data: { messageId, userId, emoji: e } });
      }
      await emitMessageUpdate(io, msg.conversationId, messageId);
    });

    // Edit your own message's text.
    socket.on("message:edit", async ({ messageId, content }, ack) => {
      const text = typeof content === "string" ? content.trim() : "";
      if (typeof messageId !== "string" || !text || text.length > 4000) {
        ack?.({ ok: false, error: "Invalid message" });
        return;
      }
      const msg = await prisma.message.findUnique({
        where: { id: messageId },
        select: { senderId: true, conversationId: true, deletedAt: true },
      });
      if (!msg || msg.deletedAt) {
        ack?.({ ok: false, error: "Message not found" });
        return;
      }
      if (msg.senderId !== userId) {
        ack?.({ ok: false, error: "You can only edit your own messages" });
        return;
      }
      await prisma.message.update({
        where: { id: messageId },
        data: { content: text, editedAt: new Date() },
      });
      await emitMessageUpdate(io, msg.conversationId, messageId);
      ack?.({ ok: true });
    });

    // Soft-delete your own message — the row stays so replies don't break.
    socket.on("message:delete", async ({ messageId }, ack) => {
      if (typeof messageId !== "string") {
        ack?.({ ok: false, error: "Invalid request" });
        return;
      }
      const msg = await prisma.message.findUnique({
        where: { id: messageId },
        select: { senderId: true, conversationId: true, deletedAt: true },
      });
      if (!msg) {
        ack?.({ ok: false, error: "Message not found" });
        return;
      }
      if (msg.senderId !== userId) {
        ack?.({ ok: false, error: "You can only delete your own messages" });
        return;
      }
      if (!msg.deletedAt) {
        await prisma.message.update({
          where: { id: messageId },
          data: {
            deletedAt: new Date(),
            attachments: { deleteMany: {} },
            reactions: { deleteMany: {} },
          },
        });
      }
      await emitMessageUpdate(io, msg.conversationId, messageId);
      ack?.({ ok: true });
    });

    // Mark the conversation read up to now → "Seen" receipts for the other members.
    socket.on("read", async ({ conversationId }) => {
      if (typeof conversationId !== "string") return;
      if (!(await isMember(userId, conversationId))) return;
      const at = new Date();
      await prisma.conversationMember.update({
        where: { conversationId_userId: { conversationId, userId } },
        data: { lastReadAt: at },
      });
      socket.to(roomFor(conversationId)).emit("read", {
        conversationId,
        userId,
        name,
        at: at.toISOString(),
      });
    });

    socket.on("call:invite", async ({ conversationId, withVideo }) => {
      if (typeof conversationId !== "string") return;
      if (!(await isMember(userId, conversationId))) return;

      const members = await prisma.conversationMember.findMany({
        where: { conversationId, userId: { not: userId } },
        select: { userId: true },
      });
      for (const m of members) {
        io.to(userRoom(m.userId)).emit("call:incoming", {
          conversationId,
          from: { id: userId, name },
          withVideo: Boolean(withVideo),
        });
      }
    });

    socket.on("typing", ({ conversationId, isTyping, text }) => {
      if (typeof conversationId !== "string") return;
      // Relay the live draft text (capped) so peers see typing in real time.
      const draft =
        typeof text === "string" ? text.slice(0, 500) : undefined;
      socket.to(roomFor(conversationId)).emit("typing", {
        conversationId,
        userId,
        name,
        isTyping: Boolean(isTyping),
        text: draft,
      });
    });

    socket.on("disconnect", () => {
      // Clear active co-presence for any conversations this socket was viewing.
      for (const conversationId of activeConvos) {
        setActive(conversationId, userId, name, false);
        socket.to(roomFor(conversationId)).emit("convo:presence", {
          conversationId,
          userId,
          name,
          active: false,
        });
      }
      activeConvos.clear();

      const count = (presence.get(userId) ?? 1) - 1;
      if (count <= 0) {
        presence.delete(userId);
        io.emit("presence", { userId, online: false });
      } else {
        presence.set(userId, count);
      }
    });
  });
}
