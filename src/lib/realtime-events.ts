// Shared Socket.io event contracts used by both the realtime server and the
// browser client.

export interface AttachmentDTO {
  url: string;
  name: string;
  contentType: string;
  size: number;
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
}

export interface CallInvite {
  conversationId: string;
  from: { id: string; name: string };
  withVideo: boolean;
}

export interface ServerToClientEvents {
  "message:new": (message: MessageDTO) => void;
  "typing": (data: {
    conversationId: string;
    userId: string;
    name: string;
    isTyping: boolean;
    /** Live draft text — what the peer is typing right now (PulseMeet live typing). */
    text?: string;
  }) => void;
  "presence": (data: { userId: string; online: boolean }) => void;
  "call:incoming": (invite: CallInvite) => void;
  "error": (message: string) => void;
}

export interface ClientToServerEvents {
  "conversation:join": (conversationId: string) => void;
  "conversation:leave": (conversationId: string) => void;
  "message:send": (
    data: { conversationId: string; content: string; attachments?: AttachmentDTO[] },
    ack?: (res: { ok: boolean; error?: string; message?: MessageDTO }) => void,
  ) => void;
  "typing": (data: { conversationId: string; isTyping: boolean; text?: string }) => void;
  "call:invite": (data: { conversationId: string; withVideo: boolean }) => void;
}

export interface SocketData {
  userId: string;
  name: string;
}
