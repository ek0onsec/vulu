"use client";
import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { resizeImage } from "@/lib/image-resize";
import { FeedCard } from "@/components/FeedCard";
import { Icon } from "@/components/Icon";
import type { FeedItem } from "@/server/application/feed";

interface CommunityDto { id: string; name: string; description: string | null; bannerUrl: string | null; memberCount: number; isMember: boolean; isPinned: boolean; isOwner: boolean }

export function CommunityClient({ id }: { id: string }) {
  const [c, setC] = useState<CommunityDto | null>(null);
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  function loadCommunity() { return api.get<{ community: CommunityDto }>(`/api/communities/${id}`).then((d) => setC(d.community)); }

  async function uploadBanner(file: File) {
    try {
      const blob = await resizeImage(file, 1500, 500);
      const res = await fetch(`/api/communities/${id}/banner`, { method: "POST", body: blob, credentials: "same-origin" });
      const data = await res.json();
      if (!res.ok) throw new ApiError(res.status, data.error, data.message);
      setC(data.community);
      toast("Bannière mise à jour");
    } catch (e) { toast(e instanceof ApiError ? e.message : "Échec de l'upload", "error"); }
  }
  useEffect(() => {
    loadCommunity().catch(() => setC(null));
    api.get<{ items: FeedItem[] }>(`/api/communities/${id}/feed`).then((d) => setItems(d.items)).catch(() => setItems([]));
  }, [id]);

  async function toggleJoin() {
    if (!c) return;
    const wasMember = c.isMember;
    setC({ ...c, isMember: !wasMember, memberCount: c.memberCount + (wasMember ? -1 : 1), isPinned: wasMember ? false : c.isPinned });
    try {
      if (wasMember) await api.del(`/api/communities/${id}/join`); else await api.post(`/api/communities/${id}/join`);
      toast(wasMember ? "Tu as quitté la communauté" : "Bienvenue !");
    } catch { toast("Action impossible", "error"); loadCommunity(); }
  }
  async function togglePin() {
    if (!c) return;
    const next = !c.isPinned; setC({ ...c, isPinned: next });
    try { await api.post(`/api/communities/${id}/pin`, { pinned: next }); toast(next ? "Épinglée sur ton feed" : "Désépinglée"); }
    catch { toast("Action impossible", "error"); setC({ ...c, isPinned: !next }); }
  }

  if (!c) return <div className="h-40 animate-pulse rounded-2xl bg-[var(--color-border)]" />;

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="relative h-28 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)]" style={c.bannerUrl ? { backgroundImage: `url(${c.bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
          {c.isOwner && (
            <>
              <button onClick={() => bannerInput.current?.click()} title="Changer la bannière"
                className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur hover:bg-black/60">
                <Icon name="camera" size={15} /> Bannière
              </button>
              <input ref={bannerInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadBanner(f); e.target.value = ""; }} />
            </>
          )}
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-bold">{c.name}</h1>
              <p className="text-sm text-[var(--color-text-muted)]">{c.memberCount} membre{c.memberCount > 1 ? "s" : ""}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              {c.isMember && (
                <button onClick={togglePin} title={c.isPinned ? "Désépingler" : "Épingler sur le feed"}
                  className={`rounded-full border p-2 ${c.isPinned ? "border-[var(--color-primary)] text-[var(--color-primary)]" : "border-[var(--color-border)] text-[var(--color-text-muted)]"}`}>
                  <Icon name="home" size={18} />
                </button>
              )}
              <button onClick={toggleJoin} className={`rounded-full px-5 py-2 text-sm font-semibold ${c.isMember ? "border border-[var(--color-border)]" : "bg-[var(--color-primary)] text-white"}`}>
                {c.isMember ? "Membre ✓" : "Rejoindre"}
              </button>
            </div>
          </div>
          {c.description && <p className="mt-3 text-sm text-[var(--color-text)]">{c.description}</p>}
        </div>
      </div>

      <h2 className="mb-3 mt-6 font-display text-lg font-bold">Fil de la communauté</h2>
      {items === null && <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-[var(--color-border)]" />)}</div>}
      {items?.length === 0 && <p className="text-sm text-[var(--color-text-muted)]">Aucune publication. Partage un avis dans cette communauté depuis une fiche !</p>}
      {items?.map((it) => <FeedCard key={it.entry.id} item={it} />)}
    </>
  );
}
