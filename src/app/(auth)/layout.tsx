import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo size="lg" />
        </div>
        <div className="glass pm-rise rounded-3xl p-8 shadow-2xl shadow-black/40">
          {children}
        </div>
        <p className="mt-6 text-center text-xs text-white/40">
          Real-time chat · video meetings · screen share
        </p>
      </div>
    </div>
  );
}
