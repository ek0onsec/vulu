"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RatingSlider } from "./RatingSlider";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import type { LibraryEntry, WorkSource, WorkType } from "@/server/domain/entities";

interface Ref { source: WorkSource; externalId: string; type: WorkType }
// Cible de partage : "circle" | "public" | id de communauté.
type Target = string;

export function EntryEditor({ workRef, initial }: { workRef: Ref; initial: LibraryEntry | null }) {
  const router = useRouter();
  const [entryId, setEntryId] = useState<string | null>(initial?.id ?? null);
  const [status, setStatus] = useState<"planned" | "done">(initial?.status ?? "planned");
  const [rating, setRating] = useState<number>(initial?.rating ?? 0);
  const [text, setText] = useState(initial?.text ?? "");
  const [target, setTarget] = useState<Target>(initial?.communityId ?? initial?.visibility ?? "circle");
  const [communities, setCommunities] = useState<{ id: string; name: string }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get<{ communities: { id: string; name: string }[] }>("/api/communities/mine").then((d) => setCommunities(d.communities)).catch(() => {}); }, []);

  async function removeEntry() {
    if (!entryId) return;
    setBusy(true);
    try {
      await api.del("/api/works/entry", { entryId });
      setEntryId(null); setStatus("planned"); setRating(0); setText("");
      toast("Retiré de ta bibliothèque");
      router.refresh();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Erreur", "error");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const isTargetCommunity = target !== "circle" && target !== "public";
      const visibility = isTargetCommunity ? "public" : target;
      const communityId = isTargetCommunity ? target : null;
      const body = status === "planned" && rating === 0 && !text.trim()
        ? { ref: workRef, status: "planned" }
        : { ref: workRef, rating: rating > 0 ? rating : null, text: text.trim() || null, visibility, communityId };
      const { entry } = await api.put<{ entry: LibraryEntry }>("/api/works/entry", body);
      setEntryId(entry.id);
      setMsg("Enregistré ✓");
      toast("Entrée enregistrée");
      router.refresh();
    } catch (err) {
      const m = err instanceof ApiError ? err.message : "Erreur";
      setMsg(m); toast(m, "error");
    } finally {
      setBusy(false);
    }
  }

  const seg = (on: boolean) =>
    `px-4 py-2 text-sm ${on ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-muted)]"}`;

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Mon entrée</p>

      <div className="mb-4 inline-flex overflow-hidden rounded-full border border-[var(--color-border)]">
        <button className={seg(status === "planned")} onClick={() => setStatus("planned")}>À voir</button>
        <button className={seg(status === "done")} onClick={() => setStatus("done")}>Vu ✓</button>
      </div>

      <RatingSlider value={rating} onChange={(v) => { setRating(v); if (v > 0) setStatus("done"); }} />

      <textarea
        value={text} onChange={(e) => setText(e.target.value)}
        placeholder="Ton avis (optionnel)…"
        className="mt-4 min-h-20 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-sm"
      />

      <p className="mt-4 mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Partager dans</p>
      <div className="flex flex-wrap gap-2">
        {([["circle", "● Cercle"], ["public", "● Public"]] as const).map(([v, label]) => (
          <button key={v} onClick={() => setTarget(v)}
            className={`rounded-full border px-4 py-1.5 text-sm ${target === v ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-[var(--color-border)] text-[var(--color-text-muted)]"}`}>{label}</button>
        ))}
        {communities.map((c) => (
          <button key={c.id} onClick={() => setTarget(c.id)}
            className={`rounded-full border px-4 py-1.5 text-sm ${target === c.id ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-[var(--color-border)] text-[var(--color-text-muted)]"}`}>◆ {c.name}</button>
        ))}
      </div>
      <button onClick={save} disabled={busy}
        className="mt-4 rounded-full bg-[var(--color-primary)] px-6 py-2 text-sm font-semibold text-white disabled:opacity-50">
        {busy ? "…" : "Enregistrer"}
      </button>
      {entryId && (
        <button onClick={removeEntry} disabled={busy}
          className="mt-3 text-sm font-medium text-red-500 hover:underline disabled:opacity-50">
          Retirer de ma bibliothèque
        </button>
      )}
      {msg && <p className="mt-2 text-sm text-[var(--color-primary)]">{msg}</p>}
    </section>
  );
}
