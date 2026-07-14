"use client";
import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/Modal";
import { toast } from "@/lib/toast";
import type { ImportPreview } from "@/server/import/tvtime-zip";
import type { ImportReport } from "@/server/domain/entities";

type Status = { status: "pending" | "running" | "done" | "error"; phase: "series" | "movies"; done: number; total: number; report: ImportReport | null; error: string | null };

export function TvTimeImportModal({ file, preview, onClose }: { file: File; preview: ImportPreview; onClose: () => void }) {
  const [phase, setPhase] = useState<"confirm" | "running" | "done">("confirm");
  const [status, setStatus] = useState<Status | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (poll.current) clearInterval(poll.current); }, []);

  async function startImport() {
    setPhase("running");
    try {
      const res = await fetch("/api/import/tvtime", { method: "POST", body: file, credentials: "same-origin" });
      const { jobId } = (await res.json()) as { jobId: string };
      if (!res.ok || !jobId) throw new Error();
      poll.current = setInterval(async () => {
        const s = (await (await fetch(`/api/import/tvtime/status?jobId=${jobId}`, { credentials: "same-origin" })).json()) as Status;
        setStatus(s);
        if (s.status === "done" || s.status === "error") {
          if (poll.current) clearInterval(poll.current);
          setPhase("done");
        }
      }, 1500);
    } catch {
      toast("Le lancement de l'import a échoué. Réessaie.", "error");
      setPhase("confirm");
    }
  }

  const pct = status && status.total > 0 ? Math.round((status.done / status.total) * 100) : 0;

  return (
    <Modal open onClose={onClose} title="Importer depuis TV Time">
      {phase === "confirm" && (
        <>
          <p className="text-sm text-[var(--color-text)]">Voici ce qui a été détecté dans ton export :</p>
          <ul className="my-3 grid grid-cols-2 gap-2 text-sm">
            <li className="rounded-xl border border-[var(--color-border)] p-3"><strong>{preview.seriesTotal}</strong> séries<br /><span className="text-xs text-[var(--color-text-muted)]">dont {preview.seriesToWatch} à voir</span></li>
            <li className="rounded-xl border border-[var(--color-border)] p-3"><strong>{preview.episodesTotal}</strong> épisodes vus</li>
            <li className="rounded-xl border border-[var(--color-border)] p-3"><strong>{preview.moviesTotal}</strong> films vus</li>
          </ul>
          <details className="mb-3 text-xs text-[var(--color-text-muted)]">
            <summary className="cursor-pointer">Voir la liste</summary>
            <div className="mt-2 max-h-40 overflow-y-auto">
              {preview.seriesNames.concat(preview.movieNames).join(" · ")}
            </div>
          </details>
          <p className="mb-3 text-xs text-[var(--color-text-muted)]">Rien ne sera partagé : tout reste privé dans ta bibliothèque. Les éléments déjà présents ne seront pas modifiés.</p>
          <div className="flex gap-2">
            <button onClick={startImport} className="flex-1 rounded-full bg-[var(--color-primary)] py-2.5 text-sm font-bold text-white">Importer</button>
            <button onClick={onClose} className="rounded-full border border-[var(--color-border)] px-4 py-2.5 text-sm font-semibold">Annuler</button>
          </div>
        </>
      )}

      {phase === "running" && (
        <>
          <p className="mb-3 text-sm text-[var(--color-text)]">Import en cours… ({status?.phase === "movies" ? "films" : "séries"})</p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
            <div className="h-full bg-[var(--color-primary)] transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">{status ? `${status.done}/${status.total}` : "Préparation…"}</p>
        </>
      )}

      {phase === "done" && status?.status === "done" && status.report && (
        <>
          <p className="mb-3 text-sm font-semibold">Import terminé ✅</p>
          <ul className="mb-3 space-y-1 text-sm">
            <li>{status.report.seriesImported} séries importées, {status.report.seriesToWatch} ajoutées « à voir »</li>
            <li>{status.report.episodesAdded} épisodes ajoutés, {status.report.episodesSkipped} déjà présents (ignorés)</li>
            <li>{status.report.moviesImported} films importés</li>
          </ul>
          {(status.report.unmatched.series.length > 0 || status.report.unmatched.movies.length > 0) && (
            <details className="mb-3 text-xs text-[var(--color-text-muted)]">
              <summary className="cursor-pointer">{status.report.unmatched.series.length + status.report.unmatched.movies.length} éléments non associés (à ajouter à la main)</summary>
              <div className="mt-2 max-h-40 overflow-y-auto">{status.report.unmatched.series.concat(status.report.unmatched.movies).filter(Boolean).join(" · ")}</div>
            </details>
          )}
          <button onClick={onClose} className="w-full rounded-full bg-[var(--color-primary)] py-2.5 text-sm font-bold text-white">Fermer</button>
        </>
      )}

      {phase === "done" && status?.status === "error" && (
        <>
          <p className="mb-3 text-sm font-semibold text-red-500">L'import a échoué.</p>
          <p className="mb-3 text-xs text-[var(--color-text-muted)]">{status.error}</p>
          <button onClick={onClose} className="w-full rounded-full border border-[var(--color-border)] py-2.5 text-sm font-semibold">Fermer</button>
        </>
      )}
    </Modal>
  );
}
