"use client";
import { useState } from "react";
import { RatingSlider } from "./RatingSlider";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import type { LibraryEntry, Visibility, WorkType } from "@/server/domain/entities";

interface Ref { source: "tmdb"; externalId: string; type: WorkType }

export function EntryEditor({ workRef, initial }: { workRef: Ref; initial: LibraryEntry | null }) {
  const [status, setStatus] = useState<"planned" | "done">(initial?.status ?? "planned");
  const [rating, setRating] = useState<number>(initial?.rating ?? 0);
  const [text, setText] = useState(initial?.text ?? "");
  const [visibility, setVisibility] = useState<Visibility>(initial?.visibility ?? "circle");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true); setMsg(null);
    try {
      if (status === "planned" && rating === 0 && !text.trim()) {
        await api.put("/api/works/entry", { ref: workRef, status: "planned" });
      } else {
        await api.put("/api/works/entry", {
          ref: workRef, rating: rating > 0 ? rating : null, text: text.trim() || null, visibility,
        });
      }
      setMsg("Enregistré ✓");
      toast("Entrée enregistrée");
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

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded-full border border-[var(--color-border)]">
          <button className={seg(visibility === "circle")} onClick={() => setVisibility("circle")}>● Cercle</button>
          <button className={seg(visibility === "public")} onClick={() => setVisibility("public")}>● Public</button>
        </div>
        <button onClick={save} disabled={busy}
          className="ml-auto rounded-full bg-[var(--color-primary)] px-6 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? "…" : "Enregistrer"}
        </button>
      </div>
      {msg && <p className="mt-2 text-sm text-[var(--color-primary)]">{msg}</p>}
    </section>
  );
}
