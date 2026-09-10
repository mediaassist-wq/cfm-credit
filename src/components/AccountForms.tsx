"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { updateProfile, changePassword } from "@/app/actions";
import { Avatar } from "@/components/Avatar";

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500";
const labelCls = "mb-1 block text-xs font-medium text-slate-600";

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
    >
      {pending ? "Saving…" : children}
    </button>
  );
}

export function AvatarUploader({
  userId,
  name,
  url,
}: {
  userId: string;
  name: string;
  url: string | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(url);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMsg("Please choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMsg("Image must be under 5 MB.");
      return;
    }

    setBusy(true);
    setMsg(null);
    try {
      const supabase = createClient();
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, cacheControl: "3600" });
      if (upErr) throw upErr;

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = data.publicUrl;

      const fd = new FormData();
      fd.set("user_id", userId);
      fd.set("avatar_url", publicUrl);
      await updateProfile(fd);

      setPreview(publicUrl);
      router.refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar name={name} url={preview} size="lg" />
      <div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={onFile}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          {busy ? "Uploading…" : preview ? "Change photo" : "Upload photo"}
        </button>
        <p className="mt-1 text-xs text-slate-400">JPG or PNG, up to 5 MB.</p>
        {msg && <p className="mt-1 text-xs text-red-600">{msg}</p>}
      </div>
    </div>
  );
}

export function NameForm({ userId, name }: { userId: string; name: string }) {
  const router = useRouter();
  return (
    <form
      action={async (fd) => {
        await updateProfile(fd);
        router.refresh();
      }}
      className="space-y-3"
    >
      <input type="hidden" name="user_id" value={userId} />
      <div>
        <label className={labelCls}>Display name</label>
        <input name="name" defaultValue={name} required className={inputCls} />
      </div>
      <SubmitButton>Save name</SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const [done, setDone] = useState(false);
  return (
    <form
      action={async (fd) => {
        await changePassword(fd);
        setDone(true);
      }}
      className="space-y-3"
    >
      <div>
        <label className={labelCls}>New password</label>
        <input
          type="password"
          name="password"
          minLength={6}
          required
          autoComplete="new-password"
          className={inputCls}
        />
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton>Change password</SubmitButton>
        {done && <span className="text-sm text-emerald-600">Password updated ✓</span>}
      </div>
    </form>
  );
}
