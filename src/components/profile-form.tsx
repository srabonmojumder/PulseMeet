"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowLeft, Camera, Loader2, Check, Trash2 } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { updateProfile } from "@/app/(app)/settings/actions";

export function ProfileForm({
  initial,
}: {
  initial: { name: string; email: string; image: string | null; bio: string };
}) {
  const router = useRouter();
  const { update } = useSession();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(initial.name);
  const [bio, setBio] = useState(initial.bio);
  const [image, setImage] = useState<string | null>(initial.image);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPickImage(file: File) {
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setImage(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    setSaved(false);
    const res = await updateProfile({ name, bio, image });
    setSaving(false);
    if (res?.error) {
      setError(res.error);
      return;
    }
    // Refresh the session so the avatar/name update everywhere immediately.
    await update({ name, image });
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/chat"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-white/60 transition hover:bg-white/5 hover:text-white"
        >
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-xl font-semibold text-white">Profile &amp; settings</h1>
      </div>

      <form onSubmit={onSave} className="space-y-5">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="group relative"
            title="Change photo"
          >
            <Avatar name={name || "?"} image={image} size="lg" />
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition group-hover:opacity-100">
              {uploading ? (
                <Loader2 size={18} className="animate-spin text-white" />
              ) : (
                <Camera size={18} className="text-white" />
              )}
            </span>
          </button>
          <div>
            <div className="text-sm font-medium text-white">Profile photo</div>
            <div className="mt-1 flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="text-xs font-medium text-indigo-400 hover:text-indigo-300"
              >
                Upload
              </button>
              {image && (
                <button
                  type="button"
                  onClick={() => setImage(null)}
                  className="flex items-center gap-1 text-xs text-white/40 hover:text-rose-400"
                >
                  <Trash2 size={12} /> Remove
                </button>
              )}
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPickImage(f);
              e.target.value = "";
            }}
          />
        </div>

        {/* Name */}
        <div>
          <label className="mb-1 block text-sm font-medium text-white/70">Display name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            required
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-indigo-500/60"
          />
        </div>

        {/* Email (read-only) */}
        <div>
          <label className="mb-1 block text-sm font-medium text-white/70">Email</label>
          <input
            value={initial.email}
            disabled
            className="w-full cursor-not-allowed rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white/40 outline-none"
          />
        </div>

        {/* Bio */}
        <div>
          <label className="mb-1 block text-sm font-medium text-white/70">
            Bio <span className="text-white/30">({bio.length}/300)</span>
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, 300))}
            rows={3}
            placeholder="Tell people a little about yourself…"
            className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-indigo-500/60"
          />
        </div>

        {error && <p className="text-sm text-rose-400">{error}</p>}

        <button
          type="submit"
          disabled={saving || uploading}
          className="brand-gradient flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:opacity-95 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 size={16} className="animate-spin" />
          ) : saved ? (
            <Check size={16} />
          ) : null}
          {saving ? "Saving…" : saved ? "Saved" : "Save changes"}
        </button>
      </form>
    </div>
  );
}
