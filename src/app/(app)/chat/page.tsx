import { MessagesSquare, Phone, Video, Paperclip } from "lucide-react";

export default function ChatIndexPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <div className="brand-gradient mb-5 flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-xl shadow-indigo-500/30">
        <MessagesSquare size={30} />
      </div>
      <h2 className="text-lg font-semibold text-white">Your conversations</h2>
      <p className="mt-1 max-w-sm text-sm text-white/50">
        Select a conversation, or start a new one to chat, call, and share files
        in real time.
      </p>
      <div className="mt-6 flex items-center gap-5 text-white/40">
        <span className="flex items-center gap-1.5 text-xs">
          <Phone size={15} /> Voice
        </span>
        <span className="flex items-center gap-1.5 text-xs">
          <Video size={15} /> Video
        </span>
        <span className="flex items-center gap-1.5 text-xs">
          <Paperclip size={15} /> Files
        </span>
      </div>
    </div>
  );
}
