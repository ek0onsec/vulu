"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "./Modal";
import { Icon } from "./Icon";
import { BookScanner } from "./BookScanner";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { resizeImage } from "@/lib/image-resize";
import type { List, Work } from "@/server/domain/entities";
import type { WorkSummary } from "@/server/ports/catalog";

export function ListDetailModal({ listId, onClose, onChanged, editable = true }: {
  listId: string; onClose: () => void; onChanged?: (workCount: number) => void; editable?: boolean;
}) {
  const router = useRouter();
  const [list, setList] = useState<List | null>(null);
  const [works, setWorks] = useState<Work[]>([]);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<WorkSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  const searchDomain = list?.kind === "books" ? "books" : "films";

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
        const d = await api.get<{ results: WorkSummary[]; unavailable?: boolean }>(`/api/catalog/search?q=${encodeURIComponent(q)}&domain=${searchDomain}`);
        setResults(d.results);
        if (d.unavailable) setSearchError("Catalogue momentanément indisponible.");
      } catch {
        setSearchError("Recherche indisponible.");
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q, adding, searchDomain]);

  async function refresh() {
    const { list: l, works: fresh } = await api.get<{ list: List; works: Work[] }>(`/api/lists/${listId}`);
    setList(l); setWorks(fresh); onChanged?.(l.workIds.length);
  }

  async function addWork(r: WorkSummary) {
    await api.post(`/api/lists/${listId}/items`, { source: r.source, externalId: r.externalId, type: r.type });
    await refresh();
    setQ(""); setResults([]); setAdding(false);
    toast(`« ${r.title} » ajouté`);
  }

  async function addScannedIsbn(isbn: string): Promise<{ ok: boolean; title?: string; posterUrl?: string | null }> {
    try {
      const { result } = await api.get<{ result: WorkSummary | null }>(`/api/catalog/isbn?isbn=${encodeURIComponent(isbn)}`);
      if (!result) { toast("Livre introuvable pour ce code-barres", "error"); return { ok: false }; }
      await api.post(`/api/lists/${listId}/items`, { source: result.source, externalId: result.externalId, type: result.type });
      return { ok: true, title: result.title, posterUrl: result.posterUrl };
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Ajout impossible", "error");
      return { ok: false };
    }
  }

  const acceptsBooks = list?.kind === "books" || list?.kind === "mixed";

  async function removeWork(w: Work) {
    setWorks((prev) => prev.filter((x) => x.id !== w.id));
    const { list: updated } = await api.del<{ list: List }>(`/api/lists/${listId}/items`, { workId: w.id });
    onChanged?.(updated.workIds.length);
    toast("Œuvre retirée", {
      action: {
        label: "Annuler",
        onClick: async () => {
          await api.post(`/api/lists/${listId}/items`, { source: w.source, externalId: w.externalId, type: w.type });
          await refresh();
          toast("Rétabli");
        },
      },
    });
  }

  async function uploadBanner(file: File) {
    try {
      const blob = await resizeImage(file, 1500, 500);
      const res = await fetch(`/api/lists/${listId}/banner`, { method: "POST", body: blob, credentials: "same-origin" });
      const data = await res.json();
      if (!res.ok) throw new ApiError(res.status, data.error, data.message);
      setList(data.list);
      toast("Bannière mise à jour");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Échec de l'upload", "error");
    }
  }

  function openWork(id: string) { onClose(); router.push(`/work/${id}`); }

  const kindLabel = list?.kind === "books" ? "Livres" : list?.kind === "films" ? "Films & Séries" : "Mixte";

  return (
    <Modal open onClose={onClose} title={list?.name ?? "Collection"}>
      {editable && (
        <button onClick={() => bannerInput.current?.click()}
          className="group relative mb-3 block h-24 w-full overflow-hidden rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)]"
          style={list?.bannerUrl ? { backgroundImage: `url(${list.bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
          aria-label="Changer la bannière de la collection">
          <span className="absolute inset-0 flex items-center justify-center gap-2 bg-black/30 text-sm text-white opacity-0 transition-opacity group-hover:opacity-100">
            <Icon name="camera" size={18} /> Bannière
          </span>
        </button>
      )}
      {!editable && list?.bannerUrl && (
        <div className="mb-3 h-24 w-full overflow-hidden rounded-xl" style={{ backgroundImage: `url(${list.bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" }} />
      )}
      <input ref={bannerInput} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadBanner(f); }} />

      {list?.description && <p className="mb-3 text-sm text-[var(--color-text-muted)]">{list.description}</p>}

      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-[var(--color-text-muted)]">{kindLabel} · {works.length} œuvre{works.length > 1 ? "s" : ""}</span>
        {editable && (
          <div className="flex items-center gap-2">
            {acceptsBooks && (
              <button onClick={() => setScanning(true)} aria-label="Scanner un livre"
                className="flex items-center gap-1.5 rounded-full border border-[var(--color-border)] px-3 py-1.5 text-sm font-semibold text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]">
                <Icon name="camera" size={16} /> Scanner
              </button>
            )}
            <button onClick={() => setAdding((a) => !a)}
              className="flex items-center gap-1.5 rounded-full border border-[var(--color-primary)] px-3 py-1.5 text-sm font-semibold text-[var(--color-primary)]">
              <Icon name="plus" size={16} /> Ajouter
            </button>
          </div>
        )}
      </div>

      {scanning && <BookScanner mode="batch" onClose={() => { setScanning(false); refresh(); }} onIsbn={addScannedIsbn} />}

      {editable && adding && (
        <div className="mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus
            placeholder={searchDomain === "books" ? "Chercher un livre…" : "Chercher un film, une série…"}
            className="w-full rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm" />
          {searching && <p className="mt-2 text-xs text-[var(--color-text-muted)]">Recherche…</p>}
          {searchError && <p className="mt-2 text-xs text-[var(--color-text-muted)]">{searchError}</p>}
          <div className="mt-2 grid grid-cols-4 gap-2">
            {results.map((r) => (
              <button key={`${r.source}-${r.externalId}`} onClick={() => addWork(r)} className="text-left">
                <div className="aspect-[2/3] overflow-hidden rounded-md bg-[var(--color-border)]"
                  style={r.posterUrl ? { backgroundImage: `url(${r.posterUrl})`, backgroundSize: "cover" } : undefined} />
                <p className="mt-1 line-clamp-2 text-[0.7rem] leading-tight">{r.title}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {works.length === 0 && !adding && <p className="text-sm text-[var(--color-text-muted)]">Collection vide. Ajoute des œuvres.</p>}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {works.map((w) => (
          <div key={w.id} className="group relative">
            <button onClick={() => openWork(w.id)} className="block w-full text-left" aria-label={`Ouvrir ${w.title}`}>
              <div className="aspect-[2/3] overflow-hidden rounded-lg bg-[var(--color-border)]"
                style={w.posterUrl ? { backgroundImage: `url(${w.posterUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} />
              <p className="mt-1 line-clamp-2 text-xs leading-tight">{w.title}</p>
            </button>
            {editable && (
              <button onClick={() => removeWork(w)} aria-label={`Retirer ${w.title}`}
                className="absolute right-1 top-1 rounded-full bg-black/65 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}
