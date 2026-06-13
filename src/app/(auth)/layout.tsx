export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-lg font-bold text-white">
            P
          </div>
          <span className="text-xl font-bold text-white">PulseMeet</span>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
          {children}
        </div>
      </div>
    </div>
  );
}
