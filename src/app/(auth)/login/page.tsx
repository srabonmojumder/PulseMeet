"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff, LogIn, Loader2, AlertCircle } from "lucide-react";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-sm text-white/50">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/chat";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await signIn("credentials", { email, password, redirect: false });
      if (res?.error) {
        setError("Invalid email or password");
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-white">Welcome back</h1>
      <p className="mb-6 mt-1 text-sm text-white/50">Sign in to continue to PulseMeet</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          icon={<Mail size={18} />}
          type="email"
          required
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
        />
        <Field
          icon={<Lock size={18} />}
          type={showPw ? "text" : "password"}
          required
          value={password}
          onChange={setPassword}
          placeholder="Password"
          trailing={
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              className="text-white/40 transition hover:text-white/70"
              tabIndex={-1}
            >
              {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          }
        />

        {error && (
          <p className="flex items-center gap-2 text-sm text-rose-400">
            <AlertCircle size={16} /> {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="brand-gradient flex w-full items-center justify-center gap-2 rounded-xl py-2.5 font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:opacity-95 disabled:opacity-50"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-white/50">
        No account?{" "}
        <Link href="/register" className="font-medium text-indigo-400 hover:text-indigo-300">
          Create one
        </Link>
      </p>
    </div>
  );
}

function Field({
  icon,
  trailing,
  value,
  onChange,
  ...rest
}: {
  icon: React.ReactNode;
  trailing?: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  return (
    <div className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3.5 transition focus-within:border-indigo-500/70 focus-within:bg-white/[0.07]">
      <span className="text-white/40 group-focus-within:text-indigo-400">{icon}</span>
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-transparent py-2.5 text-sm text-white placeholder:text-white/30 outline-none"
      />
      {trailing}
    </div>
  );
}
