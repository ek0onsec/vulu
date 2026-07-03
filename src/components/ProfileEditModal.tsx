"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "./Modal";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { resizeImage } from "@/lib/image-resize";
import type { Domain } from "@/server/domain/entities";

export interface ProfileEditInitial {
  username: string; displayName: string; bio: string | null;
  avatarUrl: string | null; bannerUrl: string | null; activeTabs: Domain[];
}

export function ProfileEditModal({ initial }: { initial: ProfileEditInitial }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [bio, setBio] = useState(initial.bio ?? "");
  const [tabs, setTabs] = useState<Domain[]>(initial.activeTabs);
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl);
  const [bannerUrl, setBannerUrl] = useState(initial.bannerUrl);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const avatarInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  function toggleTab(t: Domain) {
    setTabs((cur) => { const has = cur.includes(t); const next = has ? cur.filter((x) => x !== t) : [...cur, t]; return next.length ? next : cur; });
  }

  async function upload(kind: "avatar" | "banner", file: File) {
    setMsg(null);
    try {
      const blob = kind === "avatar" ? await resizeImage(file, 512, 512) : await resizeImage(file, 1500, 500);
      const res = await fetch(`/api/me/${kind}`, { method: "POST", body: blob, credentials: "same-origin" });
      const data = await res.json();
      if (!res.ok) throw new ApiError(res.status, data.error, data.message);
      if (kind === "avatar") setAvatarUrl(data.user.avatarUrl); else setBannerUrl(data.user.bannerUrl);
      toast(kind === "avatar" ? "Avatar mis à jour" : "Bannière mise à jour");
    } catch (e) {
      const m = e instanceof ApiError ? e.message : "Échec de l'upload";
      setMsg(m); toast(m, "error");
    }
  }

  async function save() {
    setBusy(true); setMsg(null);
    try {
      await api.patch("/api/me", { displayName, bio: bio.trim() || null, avatarUrl, activeTabs: tabs });
      setOpen(false);
      toast("Profil enregistré");
      router.refresh();
    } catch (e) {
      const m = e instanceof ApiError ? e.message : "Erreur";
      setMsg(m); toast(m, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex min-h-11 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)]">
        <Icon name="settings" size={16} /> <span className="hidden sm:inline">Éditer le profil</span>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Éditer le profil">
        <div className="overflow-hidden rounded-2xl border border-[var(--color-border)]">
          <button onClick={() => bannerInput.current?.click()}
            className="group relative block h-28 w-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)]"
            style={bannerUrl ? { backgroundImage: `url(${bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
            aria-label="Changer la bannière">
            <span className="absolute inset-0 flex items-center justify-center gap-2 bg-black/30 text-sm text-white opacity-0 transition-opacity group-hover:opacity-100">
              <Icon name="camera" size={18} /> Bannière
            </span>
          </button>
          <div className="px-4 pb-4">
            <button onClick={() => avatarInput.current?.click()} className="relative -mt-9 block rounded-full" aria-label="Changer l'avatar">
              <span className="block rounded-full ring-4 ring-[var(--color-surface)]"><Avatar name={displayName} src={avatarUrl} size={72} /></span>
              <span className="absolute bottom-0 right-0 rounded-full bg-[var(--color-primary)] p-1.5 text-white"><Icon name="camera" size={14} /></span>
            </button>
          </div>
        </div>

        <input ref={avatarInput} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload("avatar", f); }} />
        <input ref={bannerInput} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload("banner", f); }} />

        <div className="mt-4 flex flex-col gap-4">
          <label className="text-sm font-semibold">Nom affiché
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm font-normal" />
          </label>
          <label className="text-sm font-semibold">Bio
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={300} rows={3}
              className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm font-normal" />
          </label>
          <div>
            <p className="mb-2 text-sm font-semibold">Mes onglets</p>
            <div className="flex gap-2">
              {(["films", "books"] as Domain[]).map((t) => (
                <button key={t} onClick={() => toggleTab(t)}
                  className={`rounded-full border px-4 py-1.5 text-sm ${tabs.includes(t) ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-[var(--color-border)] text-[var(--color-text-muted)]"}`}>
                  {t === "films" ? "Films & Séries" : "Livres"}
                </button>
              ))}
            </div>
          </div>
          {msg && <p className="text-sm text-red-500">{msg}</p>}
          <button onClick={save} disabled={busy}
            className="rounded-full bg-[var(--color-primary)] py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? "…" : "Enregistrer"}
          </button>
        </div>
      </Modal>
    </>
  );
}
