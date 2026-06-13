import type { Server, Socket } from "socket.io";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifySocketToken } from "@/lib/socket-token";
import type {
  ClientToServerEvents,
  MessageDTO,
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

const sendSchema = z
  .object({
    conversationId: z.string().min(1),
    content: z.string().trim().max(4000),
    attachments: z.array(attachmentSchema).max(10).optional(),
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
      const { conversationId, content, attachments } = parsed.data;

      if (!(await isMember(userId, conversationId))) {
        ack?.({ ok: false, error: "Not a member of this conversation" });
        return;
      }

      const created = await prisma.message.create({
        data: {
          conversationId,
          senderId: userId,
          content,
          attachments: attachments?.length
            ? { create: attachments }
            : undefined,
        },
        include: {
          sender: { select: { id: true, name: true, image: true } },
          attachments: {
            select: { url: true, name: true, contentType: true, size: true },
          },
        },
      });
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      const dto: MessageDTO = {
        id: created.id,
        conversationId: created.conversationId,
        content: created.content,
        createdAt: created.createdAt.toISOString(),
        sender: created.sender,
        attachments: created.attachments,
      };

      io.to(roomFor(conversationId)).emit("message:new", dto);
      ack?.({ ok: true, message: dto });
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
