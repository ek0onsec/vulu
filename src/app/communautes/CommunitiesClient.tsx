"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { Modal } from "@/components/Modal";
import { Icon } from "@/components/Icon";

interface CommunityDto { id: string; name: string; slug: string; description: string | null; bannerUrl: string | null; memberCount: number; isMember: boolean; isPinned: boolean; visibility: "public" | "private" }

export function CommunitiesClient({ plus }: { plus: boolean }) {
  const [list, setList] = useState<CommunityDto[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [busy, setBusy] = useState(false);

  const load = () => api.get<{ communities: CommunityDto[] }>("/api/communities").then((d) => setList(d.communities)).catch(() => setList([]));
  useEffect(() => { load(); }, []);

  async function create() {
    if (name.trim().length < 2) return;
    setBusy(true);
    try { await api.post("/api/communities", { name, description: description.trim() || null, visibility }); setName(""); setDescription(""); setVisibility("public"); setCreating(false); toast("Communauté créée"); load(); }
    catch { toast("Action impossible", "error"); } finally { setBusy(false); }
  }

  async function toggleJoin(c: CommunityDto) {
    setList((prev) => prev?.map((x) => x.id === c.id ? { ...x, isMember: !x.isMember, memberCount: x.memberCount + (x.isMember ? -1 : 1) } : x) ?? null);
    try {
      if (c.isMember) await api.del(`/api/communities/${c.id}/join`);
      else await api.post(`/api/communities/${c.id}/join`);
      toast(c.isMember ? "Tu as quitté la communauté" : "Bienvenue dans la communauté !");
    } catch { toast("Action impossible", "error"); load(); }
  }

  return (
    <>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Communautés</h1>
        {plus
          ? <button onClick={() => setCreating(true)} data-tour="community-cta" className="flex items-center gap-1.5 rounded-full bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white"><Icon name="plus" size={18} /> Créer</button>
          : <Link href="/plus" title="Réservé à vulu+" data-tour="community-cta" className="flex items-center gap-1.5 rounded-full border border-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)]"><Icon name="lock" size={16} /> Créer · vulu+</Link>}
      </div>

      {list === null && <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-[var(--color-border)]" />)}</div>}

      {list?.length === 0 && (plus
        ? <p className="text-sm text-[var(--color-text-muted)]">Aucune communauté. Crée la première !</p>
        : (
          <div className="pt-2">
            <p className="text-sm text-[var(--color-text-muted)]">Aucune communauté pour l’instant.</p>
            <Link href="/plus" aria-label="Créer une communauté avec vulu+" title="Réservé à vulu+"
              className="mt-16 flex select-none flex-col items-center text-center leading-[0.95] transition-transform active:scale-[0.99]">
              <span className="text-[clamp(2.5rem,12vw,4rem)] font-black tracking-tight"
                style={{ color: "var(--color-primary)", textShadow: "0 2px 28px color-mix(in srgb, var(--color-primary) 28%, transparent)" }}>
                Créer une<br />communauté<br />avec vulu+
              </span>
            </Link>
          </div>
        ))}
      <div className="flex flex-col gap-3">
        {list?.map((c) => (
          <div key={c.id} className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
            <div className="h-16 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)]" style={c.bannerUrl ? { backgroundImage: `url(${c.bannerUrl})`, backgroundSize: "cover" } : undefined} />
            <div className="flex items-start gap-3 p-4">
              <Link href={`/communaute/${c.id}`} className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 font-display text-lg font-bold">{c.name}{c.visibility === "private" && <Icon name="lock" size={14} />}</p>
                {c.description && <p className="line-clamp-2 text-sm text-[var(--color-text)]">{c.description}</p>}
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">{c.memberCount} membre{c.memberCount > 1 ? "s" : ""}</p>
              </Link>
              <button onClick={() => toggleJoin(c)} className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold ${c.isMember ? "border border-[var(--color-border)] text-[var(--color-text)]" : "bg-[var(--color-primary)] text-white"}`}>
                {c.isMember ? "Membre ✓" : c.visibility === "private" ? "Demander" : "Rejoindre"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={creating} onClose={() => setCreating(false)} title="Nouvelle communauté">
        <div className="flex flex-col gap-4">
          <label className="text-sm font-semibold">Nom
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="ex. Cinéphiles SF"
              className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm font-normal" />
          </label>
          <label className="text-sm font-semibold">Description <span className="font-normal text-[var(--color-text-muted)]">(optionnel)</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} rows={3}
              className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm font-normal" />
          </label>
          <div>
            <p className="mb-1 text-sm font-semibold">Visibilité</p>
            <div className="flex gap-2">
              {(["public", "private"] as const).map((v) => (
                <button key={v} type="button" onClick={() => setVisibility(v)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold ${visibility === v ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-[var(--color-border)] text-[var(--color-text-muted)]"}`}>
                  {v === "public" ? "Publique" : "Privée 🔒"}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">{visibility === "private" ? "Les demandes d'adhésion devront être approuvées." : "Tout le monde peut rejoindre et voir le fil."}</p>
          </div>
          <button onClick={create} disabled={busy || name.trim().length < 2} className="rounded-full bg-[var(--color-primary)] py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "…" : "Créer la communauté"}</button>
        </div>
      </Modal>
    </>
  );
}
