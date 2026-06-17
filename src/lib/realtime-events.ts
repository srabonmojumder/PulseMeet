// Shared Socket.io event contracts used by both the realtime server and the
// browser client.

export interface AttachmentDTO {
  url: string;
  name: string;
  contentType: string;
  size: number;
}

export interface ReactionDTO {
  emoji: string;
  userId: string;
  name: string;
}

/** Compact preview of the message being replied to (quote-reply). */
export interface ReplyPreviewDTO {
  id: string;
  senderName: string;
  content: string;
  hasAttachments: boolean;
}

export interface MessageDTO {
  id: string;
  conversationId: string;
  content: string;
  createdAt: string;
  sender: {
    id: string;
    name: string;
    image: string | null;
  };
  attachments: AttachmentDTO[];
  reactions: ReactionDTO[];
  replyTo: ReplyPreviewDTO | null;
  /** ISO timestamp the message was last edited, or null. */
  editedAt: string | null;
  /** ISO timestamp the message was deleted, or null (content is blanked when set). */
  deletedAt: string | null;
  /** ISO timestamp a disappearing message vanishes at, or null. */
  expiresAt: string | null;
  /** ISO timestamp the message was pinned, or null. */
  pinnedAt: string | null;
  /** ISO timestamp a scheduled message is due to send, or null. */
  scheduledFor: string | null;
}

export interface CallInvite {
  conversationId: string;
  from: { id: string; name: string };
  withVideo: boolean;
}

export interface ServerToClientEvents {
  "message:new": (message: MessageDTO) => void;
  /** A message changed — edited, deleted, or its reactions updated. Replace by id. */
  "message:update": (message: MessageDTO) => void;
  /** Lightweight nudge delivered to every member's personal room so the sidebar
   *  can move the conversation to the top + flag it unread, even when the member
   *  isn't currently viewing that conversation. */
  "conversation:activity": (data: {
    conversationId: string;
    senderId: string;
    preview: string;
    hasAttachment: boolean;
    createdAt: string;
  }) => void;
  /** Read receipt: this member has read the conversation up to `at`. */
  "read": (data: { conversationId: string; userId: string; name: string; at: string }) => void;
  "typing": (data: {
    conversationId: string;
    userId: string;
    name: string;
    isTyping: boolean;
    /** Live draft text — what the peer is typing right now (PulseMeet live typing). */
    text?: string;
  }) => void;
  "presence": (data: { userId: string; online: boolean }) => void;
  /** Per-conversation co-presence: someone is actively viewing this chat right now. */
  "convo:presence": (data: {
    conversationId: string;
    userId: string;
    name: string;
    active: boolean;
  }) => void;
  /** A synchronized floating reaction to animate on every member's screen. */
  "reaction:fly": (data: {
    conversationId: string;
    userId: string;
    name: string;
    emoji: string;
  }) => void;
  "call:incoming": (invite: CallInvite) => void;
  "error": (message: string) => void;
}

export interface ClientToServerEvents {
  "conversation:join": (conversationId: string) => void;
  "conversation:leave": (conversationId: string) => void;
  "message:send": (
    data: {
      conversationId: string;
      content: string;
      attachments?: AttachmentDTO[];
      /** id of the message this one replies to (quote-reply). */
      replyToId?: string;
      /** disappearing message: seconds until it vanishes (0/undefined = permanent). */
      expireSeconds?: number;
      /** scheduled send: seconds from now to deliver (0/undefined = send now). */
      scheduleSeconds?: number;
    },
    ack?: (res: { ok: boolean; error?: string; message?: MessageDTO }) => void,
  ) => void;
  /** Pin or unpin a message to the top of the conversation. */
  "message:pin": (
    data: { messageId: string; pinned: boolean },
    ack?: (res: { ok: boolean; error?: string }) => void,
  ) => void;
  /** Add the emoji if absent, remove it if you already reacted with it. */
  "reaction:toggle": (data: { messageId: string; emoji: string }) => void;
  /** Edit your own message's text. */
  "message:edit": (
    data: { messageId: string; content: string },
    ack?: (res: { ok: boolean; error?: string }) => void,
  ) => void;
  /** Soft-delete your own message ("This message was deleted"). */
  "message:delete": (
    data: { messageId: string },
    ack?: (res: { ok: boolean; error?: string }) => void,
  ) => void;
  /** Mark the conversation read up to now (drives "Seen" receipts). */
  "read": (data: { conversationId: string }) => void;
  "typing": (data: { conversationId: string; isTyping: boolean; text?: string }) => void;
  /** Tell peers whether you are actively viewing this conversation. */
  "convo:active": (data: { conversationId: string; active: boolean }) => void;
  /** Broadcast a floating reaction to everyone in the conversation. */
  "reaction:fly": (data: { conversationId: string; emoji: string }) => void;
  "call:invite": (data: { conversationId: string; withVideo: boolean }) => void;
}

export interface SocketData {
  userId: string;
  name: string;
}
