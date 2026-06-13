export default function ChatIndexPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600/20 text-3xl">
        💬
      </div>
      <h2 className="text-lg font-semibold text-white">Your conversations</h2>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        Select a conversation on the left, or start a new one to begin chatting in
        real time.
      </p>
    </div>
  );
}
