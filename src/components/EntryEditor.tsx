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

export function EntryEditor({ workRef, initial, workType, episodeCounts, pageCount }: {
  workRef: Ref; initial: LibraryEntry | null;
  workType: WorkType; episodeCounts: number[] | null; pageCount: number | null;
}) {
  const router = useRouter();
  const [entryId, setEntryId] = useState<string | null>(initial?.id ?? null);
  const [status, setStatus] = useState<"planned" | "in_progress" | "done">(initial?.status ?? "planned");
  const [rating, setRating] = useState<number>(initial?.rating ?? 0);
  const [text, setText] = useState(initial?.text ?? "");
  const [target, setTarget] = useState<Target>(initial?.communityId ?? initial?.visibility ?? "circle");
  const [communities, setCommunities] = useState<{ id: string; name: string }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [season, setSeason] = useState(initial?.progress?.season ?? 1);
  const [episode, setEpisode] = useState(initial?.progress?.episode ?? 1);
  const [tome, setTome] = useState(initial?.progress?.tome ?? 1);
  const [page, setPage] = useState(initial?.progress?.page ?? 1);

  async function saveProgress(share: boolean) {
    setBusy(true);
    try {
      const body: Record<string, unknown> = { ref: workRef };
      if (workType === "tv") { body.season = season; body.episode = episode; }
      else if (workType === "book") { body.tome = tome; body.page = page; }
      const { entry } = await api.put<{ entry: LibraryEntry }>("/api/works/progress", body);
      setEntryId(entry.id);
      if (share) { await api.post(`/api/entries/${entry.id}/share`); toast("Jalon partagé dans ton feed"); }
      else toast("Progression enregistrée");
      router.refresh();
    } catch (e) { toast(e instanceof ApiError ? e.message : "Erreur", "error"); }
    finally { setBusy(false); }
  }

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

  const Stepper = ({ label, value, set, max }: { label: string; value: number; set: (n: number) => void; max: number | null }) => (
    <div className="flex items-center gap-2">
      <span className="w-16 text-sm text-[var(--color-text-muted)]">{label}</span>
      <button onClick={() => set(Math.max(1, value - 1))} className="h-8 w-8 rounded-full border border-[var(--color-border)]">−</button>
      <span className="min-w-10 text-center text-sm font-semibold">{value}{max ? <span className="text-[var(--color-text-muted)]"> / {max}</span> : null}</span>
      <button onClick={() => set(max ? Math.min(max, value + 1) : value + 1)} className="h-8 w-8 rounded-full border border-[var(--color-border)]">+</button>
    </div>
  );

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Mon entrée</p>

      <div className="mb-4 inline-flex overflow-hidden rounded-full border border-[var(--color-border)]">
        <button className={seg(status === "planned")} onClick={() => setStatus("planned")}>À voir</button>
        <button className={seg(status === "in_progress")} onClick={() => setStatus("in_progress")}>En cours</button>
        <button className={seg(status === "done")} onClick={() => setStatus("done")}>Vu ✓</button>
      </div>

      {status === "in_progress" && workType === "tv" && (
        <div className="mb-4 flex flex-col gap-2 rounded-xl border border-[var(--color-border)] p-3">
          <Stepper label="Saison" value={season} set={setSeason} max={episodeCounts ? episodeCounts.length : null} />
          <Stepper label="Épisode" value={episode} set={setEpisode} max={episodeCounts?.[season - 1] ?? null} />
          <div className="flex gap-2 pt-1">
            <button onClick={() => saveProgress(false)} disabled={busy} className="rounded-full bg-[var(--color-primary)] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">Enregistrer</button>
            <button onClick={() => saveProgress(true)} disabled={busy} className="rounded-full border border-[var(--color-primary)] px-4 py-1.5 text-sm font-semibold text-[var(--color-primary)]">Partager ce jalon</button>
          </div>
        </div>
      )}
      {status === "in_progress" && workType === "book" && (
        <div className="mb-4 flex flex-col gap-2 rounded-xl border border-[var(--color-border)] p-3">
          <Stepper label="Tome" value={tome} set={setTome} max={null} />
          <Stepper label="Page" value={page} set={setPage} max={pageCount} />
          <div className="flex gap-2 pt-1">
            <button onClick={() => saveProgress(false)} disabled={busy} className="rounded-full bg-[var(--color-primary)] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">Enregistrer</button>
            <button onClick={() => saveProgress(true)} disabled={busy} className="rounded-full border border-[var(--color-primary)] px-4 py-1.5 text-sm font-semibold text-[var(--color-primary)]">Partager ce jalon</button>
          </div>
        </div>
      )}

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
