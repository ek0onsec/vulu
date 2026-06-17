"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "./Modal";
import { Icon } from "./Icon";
import { api } from "@/lib/api-client";
import type { List, Work } from "@/server/domain/entities";
import type { WorkSummary } from "@/server/ports/catalog";

export function ListDetailModal({ listId, onClose, onChanged }: {
  listId: string; onClose: () => void; onChanged: (workCount: number) => void;
}) {
  const router = useRouter();
  const [list, setList] = useState<List | null>(null);
  const [works, setWorks] = useState<Work[]>([]);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<WorkSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api.get<{ list: List; works: Work[] }>(`/api/lists/${listId}`)
      .then((d) => { setList(d.list); setWorks(d.works); })
      .catch(() => onClose());
  }, [listId, onClose]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!adding || !q.trim()) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      setSearching(true); setSearchError(null);
      try {
        const d = await api.get<{ results: WorkSummary[] }>(`/api/catalog/search?q=${encodeURIComponent(q)}`);
        setResults(d.results);
      } catch {
        setSearchError("Recherche indisponible (clé TMDB requise).");
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q, adding]);

  async function addWork(r: WorkSummary) {
    const { list: updated } = await api.post<{ list: List }>(`/api/lists/${listId}/items`, {
      source: "tmdb", externalId: r.externalId, type: r.type,
    });
    const { works: fresh } = await api.get<{ works: Work[] }>(`/api/lists/${listId}`);
    setWorks(fresh); onChanged(updated.workIds.length);
    setQ(""); setResults([]); setAdding(false);
  }

  async function removeWork(workId: string) {
    const { list: updated } = await api.del<{ list: List }>(`/api/lists/${listId}/items`, { workId });
    setWorks((prev) => prev.filter((w) => w.id !== workId));
    onChanged(updated.workIds.length);
  }

  function openWork(id: string) { onClose(); router.push(`/work/${id}`); }

  return (
    <Modal open onClose={onClose} title={list?.name ?? "Liste"}>
      {list?.description && <p className="mb-4 text-sm text-[var(--color-text-muted)]">{list.description}</p>}

      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-[var(--color-text-muted)]">{works.length} œuvre{works.length > 1 ? "s" : ""}</span>
        <button onClick={() => setAdding((a) => !a)}
          className="flex items-center gap-1.5 rounded-full border border-[var(--color-primary)] px-3 py-1.5 text-sm font-semibold text-[var(--color-primary)]">
          <Icon name="plus" size={16} /> Ajouter
        </button>
      </div>

      {adding && (
        <div className="mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder="Chercher un film, une série…"
            className="w-full rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm" />
          {searching && <p className="mt-2 text-xs text-[var(--color-text-muted)]">Recherche…</p>}
          {searchError && <p className="mt-2 text-xs text-[var(--color-text-muted)]">{searchError}</p>}
          <div className="mt-2 grid grid-cols-4 gap-2">
            {results.map((r) => (
              <button key={`${r.type}-${r.externalId}`} onClick={() => addWork(r)} className="text-left">
                <div className="aspect-[2/3] overflow-hidden rounded-md bg-[var(--color-border)]"
                  style={r.posterUrl ? { backgroundImage: `url(${r.posterUrl})`, backgroundSize: "cover" } : undefined} />
                <p className="mt-1 line-clamp-2 text-[0.7rem] leading-tight">{r.title}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {works.length === 0 && !adding && <p className="text-sm text-[var(--color-text-muted)]">Liste vide. Ajoute des œuvres.</p>}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {works.map((w) => (
          <div key={w.id} className="group relative">
            <button onClick={() => openWork(w.id)} className="block w-full text-left" aria-label={`Ouvrir ${w.title}`}>
              <div className="aspect-[2/3] overflow-hidden rounded-lg bg-[var(--color-border)]"
                style={w.posterUrl ? { backgroundImage: `url(${w.posterUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} />
              <p className="mt-1 line-clamp-2 text-xs leading-tight">{w.title}</p>
            </button>
            <button onClick={() => removeWork(w.id)} aria-label={`Retirer ${w.title}`}
              className="absolute right-1 top-1 rounded-full bg-black/65 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>
        ))}
      </div>
    </Modal>
  );
}
