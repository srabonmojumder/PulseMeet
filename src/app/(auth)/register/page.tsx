"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User, Mail, Lock, Eye, EyeOff, UserPlus, Loader2, AlertCircle } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Registration failed");
      setLoading(false);
      return;
    }

    const signInRes = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);

    if (signInRes?.error) {
      router.push("/login");
      return;
    }
    router.push("/chat");
    router.refresh();
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-white">Create account</h1>
      <p className="mb-6 mt-1 text-sm text-white/50">Start chatting and meeting on PulseMeet</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field icon={<User size={18} />} type="text" required value={name} onChange={setName} placeholder="Your name" />
        <Field icon={<Mail size={18} />} type="email" required value={email} onChange={setEmail} placeholder="you@example.com" />
        <Field
          icon={<Lock size={18} />}
          type={showPw ? "text" : "password"}
          required
          minLength={6}
          value={password}
          onChange={setPassword}
          placeholder="Password (min 6 characters)"
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
          {loading ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
          {loading ? "Creating…" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-white/50">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-indigo-400 hover:text-indigo-300">
          Sign in
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
