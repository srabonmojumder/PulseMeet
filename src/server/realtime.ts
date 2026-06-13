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

const sendSchema = z.object({
  conversationId: z.string().min(1),
  content: z.string().trim().min(1).max(4000),
});

// userId -> count of live sockets (for presence).
const presence = new Map<string, number>();

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

    // Track presence and announce coming online (first socket only).
    const prev = presence.get(userId) ?? 0;
    presence.set(userId, prev + 1);
    if (prev === 0) io.emit("presence", { userId, online: true });

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
      const { conversationId, content } = parsed.data;

      if (!(await isMember(userId, conversationId))) {
        ack?.({ ok: false, error: "Not a member of this conversation" });
        return;
      }

      const created = await prisma.message.create({
        data: { conversationId, senderId: userId, content },
        include: { sender: { select: { id: true, name: true, image: true } } },
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
      };

      io.to(roomFor(conversationId)).emit("message:new", dto);
      ack?.({ ok: true, message: dto });
    });

    socket.on("typing", ({ conversationId, isTyping }) => {
      if (typeof conversationId !== "string") return;
      socket
        .to(roomFor(conversationId))
        .emit("typing", { conversationId, userId, name, isTyping: Boolean(isTyping) });
    });

    socket.on("disconnect", () => {
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
