"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RatingSlider } from "./RatingSlider";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { statusLabel } from "@/lib/status-label";
import type { LibraryEntry, WorkSource, WorkType } from "@/server/domain/entities";

interface Ref { source: WorkSource; externalId: string; type: WorkType }

export function EntryEditor({ workRef, initial, workType, episodeCounts, pageCount }: {
  workRef: Ref; initial: LibraryEntry | null;
  workType: WorkType; episodeCounts: number[] | null; pageCount: number | null;
}) {
  const router = useRouter();
  const [entryId, setEntryId] = useState<string | null>(initial?.id ?? null);
  const [status, setStatus] = useState<"planned" | "in_progress" | "done">(initial?.status ?? "planned");
  const [rating, setRating] = useState<number>(initial?.rating ?? 0);
  const [text, setText] = useState(initial?.text ?? "");
  const [completedAt, setCompletedAt] = useState<string>(initial?.completedAt ? new Date(initial.completedAt).toISOString().slice(0, 10) : "");
  const [sharePublic, setSharePublic] = useState<boolean>(initial?.audiences.public ?? false);
  const [shareCircle, setShareCircle] = useState<boolean>(initial?.audiences.circle ?? true);
  const [shareCommunities, setShareCommunities] = useState<Set<string>>(
    () => new Set(initial?.audiences.communityIds ?? []),
  );
  const [communities, setCommunities] = useState<{ id: string; name: string }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
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
      setEntryId(null); setStatus("planned"); setRating(0); setText(""); setConfirmRemove(false);
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
      const communityIds = [...shareCommunities];
      const audiences = { public: sharePublic, circle: shareCircle, communityIds };
      const isReview = !(status === "planned" && rating === 0 && !text.trim());
      // Aucune destination = « gardé pour moi » : l'entrée (note/avis) reste privée, hors feed.
      const completedIso = completedAt ? new Date(completedAt).toISOString() : null;
      const body = isReview
        ? { ref: workRef, rating: rating > 0 ? rating : null, text: text.trim() || null, completedAt: completedIso, audiences }
        : { ref: workRef, status: "planned" };
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

  const keepPrivate = !sharePublic && !shareCircle && shareCommunities.size === 0;

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
        <button className={seg(status === "planned")} onClick={() => setStatus("planned")}>{statusLabel("planned", workType)}</button>
        <button className={seg(status === "in_progress")} onClick={() => setStatus("in_progress")}>{statusLabel("in_progress", workType)}</button>
        <button className={seg(status === "done")} onClick={() => { setStatus("done"); if (!completedAt) setCompletedAt(new Date().toISOString().slice(0, 10)); }}>{statusLabel("done", workType)} ✓</button>
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

      {status === "done" && (
        <label className="mt-4 block text-sm font-semibold">Date de {workType === "book" ? "lecture" : "visionnage"}
          <input type="date" value={completedAt} onChange={(e) => setCompletedAt(e.target.value)}
            className="mt-1 block rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm font-normal" />
        </label>
      )}

      <p className="mt-4 mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Partager dans</p>
      <p className="mb-1.5 text-xs text-[var(--color-text-muted)]">Plusieurs destinations possibles — ou garde ça pour toi (rien n'apparaît dans le feed).</p>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => { setSharePublic(false); setShareCircle(false); setShareCommunities(new Set()); }}
          className={`rounded-full border px-4 py-1.5 text-sm ${keepPrivate ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-[var(--color-border)] text-[var(--color-text-muted)]"}`}>
          {keepPrivate ? "✓ " : ""}🔒 Garder pour moi
        </button>
        <button onClick={() => setSharePublic((v) => !v)}
          className={`rounded-full border px-4 py-1.5 text-sm ${sharePublic ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-[var(--color-border)] text-[var(--color-text-muted)]"}`}>
          {sharePublic ? "✓ " : ""}● Public
        </button>
        <button onClick={() => setShareCircle((v) => !v)}
          className={`rounded-full border px-4 py-1.5 text-sm ${shareCircle ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-[var(--color-border)] text-[var(--color-text-muted)]"}`}>
          {shareCircle ? "✓ " : ""}● Cercle
        </button>
        {communities.map((c) => {
          const on = shareCommunities.has(c.id);
          return (
            <button key={c.id} onClick={() => setShareCommunities((prev) => { const next = new Set(prev); if (next.has(c.id)) next.delete(c.id); else next.add(c.id); return next; })}
              className={`rounded-full border px-4 py-1.5 text-sm ${on ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-[var(--color-border)] text-[var(--color-text-muted)]"}`}>
              {on ? "✓ " : ""}◆ {c.name}
            </button>
          );
        })}
      </div>
      <button onClick={save} disabled={busy}
        className="mt-5 w-full rounded-full bg-[var(--color-primary)] py-3 text-base font-bold text-white shadow-[0_4px_16px_color-mix(in_srgb,var(--color-primary)_45%,transparent)] transition-transform active:scale-[0.98] disabled:opacity-50">
        {busy ? "…" : "Valider"}
      </button>
      {entryId && (
        <div className="mt-4 border-t border-[var(--color-border)] pt-3">
          {!confirmRemove ? (
            <button onClick={() => setConfirmRemove(true)} disabled={busy}
              className="rounded-full border border-red-500/40 px-4 py-1.5 text-sm font-semibold text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-50">
              Retirer de ma bibliothèque
            </button>
          ) : (
            <div className="flex flex-col gap-2 rounded-xl border border-red-500/40 bg-red-500/5 p-3">
              <p className="text-sm font-medium">Retirer « {workType === "book" ? "ce livre" : "cette œuvre"} » de ta bibliothèque ? Ta note et ton avis seront supprimés.</p>
              <div className="flex gap-2">
                <button onClick={removeEntry} disabled={busy}
                  className="rounded-full bg-red-500 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "…" : "Oui, retirer"}</button>
                <button onClick={() => setConfirmRemove(false)} disabled={busy}
                  className="rounded-full border border-[var(--color-border)] px-4 py-1.5 text-sm font-semibold">Annuler</button>
              </div>
            </div>
          )}
        </div>
      )}
      {msg && <p className="mt-2 text-sm text-[var(--color-primary)]">{msg}</p>}
    </section>
  );
}
