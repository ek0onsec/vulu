"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { Modal } from "@/components/Modal";
import { Icon } from "@/components/Icon";
import { personHref } from "@/lib/person";
import { PlaylistCard } from "@/components/PlaylistCard";
import { ListDetailModal } from "@/components/ListDetailModal";
import { BookScanner } from "@/components/BookScanner";
import type { Library, LibraryPoster } from "@/server/application/library";
import type { WorkType } from "@/server/domain/entities";
import type { WorkSummary } from "@/server/ports/catalog";
import type { ListVisibility } from "@/server/domain/entities";

type TypeFilter = "all" | "movie" | "tv" | "book";
const FILTERS: { id: TypeFilter; label: string }[] = [
  { id: "all", label: "Tout" }, { id: "movie", label: "Films" }, { id: "tv", label: "Séries" }, { id: "book", label: "Livres" },
];

function PosterRow({ items, empty }: { items: LibraryPoster[]; empty: string }) {
  if (items.length === 0) return <p className="py-4 text-sm text-[var(--color-text-muted)]">{empty}</p>;
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
      {items.map((it) => (
        <Link key={it.id} href={`/work/${it.workId}`}
          className="relative aspect-[2/3] overflow-hidden rounded-xl bg-[var(--color-border)] transition-transform hover:scale-[1.03]"
          style={it.posterUrl ? { backgroundImage: `url(${it.posterUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
          {it.rating !== null && (
            <span className="absolute bottom-1 left-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[0.65rem] font-bold text-[var(--color-accent)]">★ {it.rating.toFixed(1).replace(".", ",")}</span>
          )}
        </Link>
      ))}
    </div>
  );
}

export function LibraryClient() {
  const [data, setData] = useState<Library | null>(null);
  const [filter, setFilter] = useState<TypeFilter>("all");
  const [person, setPerson] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<"films" | "books" | "mixed">("mixed");
  const [visibility, setVisibility] = useState<ListVisibility>("public");
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const load = useCallback(() => {
    api.get<Library>("/api/library").then(setData).catch(() => setData({ playlists: [], watchlist: [], seen: [], people: [] }));
  }, []);
  useEffect(() => { load(); }, [load]);

  const match = (t: WorkType) => filter === "all" || t === filter;

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api.post("/api/lists", { name, kind, description: description.trim() || null, visibility });
      setName(""); setDescription(""); setKind("mixed"); setVisibility("public"); setCreating(false);
      toast("Collection créée"); load();
    } catch { toast("Action impossible", "error"); } finally { setBusy(false); }
  }

  async function addScannedBook(isbn: string) {
    try {
      const { result } = await api.get<{ result: WorkSummary | null }>(`/api/catalog/isbn?isbn=${encodeURIComponent(isbn)}`);
      if (!result) { toast("Livre introuvable pour ce code-barres", "error"); return; }
      await api.put("/api/works/entry", { ref: { source: result.source, externalId: result.externalId, type: result.type }, status: "planned" });
      setScanning(false);
      toast(`« ${result.title} » ajouté à ta liste à lire`);
      load();
    } catch { toast("Ajout impossible", "error"); }
  }

  if (!data) {
    return <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">{Array.from({ length: 10 }).map((_, i) => <div key={i} className="aspect-[2/3] animate-pulse rounded-xl bg-[var(--color-border)]" />)}</div>;
  }

  const matchPerson = (ids: number[]) => person === null || ids.includes(person);
  const watchlist = data.watchlist.filter((x) => match(x.type) && matchPerson(x.peopleIds));
  const seen = data.seen.filter((x) => match(x.type) && matchPerson(x.peopleIds));
  const selectedPerson = person !== null ? data.people.find((x) => x.id === person) ?? null : null;

  return (
    <>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Bibliothèque</h1>
        <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 rounded-full bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white">
          <Icon name="plus" size={18} /> Collection
        </button>
      </div>

      <div className="mb-3 flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-sm transition-colors ${filter === f.id ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]"}`}>
            {f.label}
          </button>
        ))}
      </div>

      {data.people.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <select value={person ?? ""} onChange={(e) => setPerson(e.target.value ? Number(e.target.value) : null)}
            className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-1.5 text-sm">
            <option value="">Toutes les personnes</option>
            {data.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {selectedPerson && (
            <Link href={personHref({ tmdbId: selectedPerson.id, name: selectedPerson.name }, selectedPerson.role === "author" ? "book" : "tmdb")}
              className="text-sm font-semibold text-[var(--color-primary)] hover:underline">Voir la page de {selectedPerson.name}</Link>
          )}
        </div>
      )}

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Mes collections</h2>
          <span className="text-xs text-[var(--color-text-muted)]">{data.playlists.length}</span>
        </div>
        {data.playlists.length === 0
          ? <p className="text-sm text-[var(--color-text-muted)]">Crée ta première collection (films, séries et livres peuvent cohabiter).</p>
          : <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {data.playlists.map((p) => <PlaylistCard key={p.id} playlist={p} onOpen={() => setViewing(p.id)} />)}
            </div>}
      </section>

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold">À voir / à lire <span className="text-sm font-normal text-[var(--color-text-muted)]">· {watchlist.length}</span></h2>
          {(filter === "book" || filter === "all") && (
            <button onClick={() => setScanning(true)} aria-label="Scanner un livre"
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--color-border)] px-3 py-1.5 text-sm font-semibold text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]">
              <Icon name="camera" size={16} /> Scanner un livre
            </button>
          )}
        </div>
        <PosterRow items={watchlist} empty="Rien dans ta liste d’envies pour ce filtre." />
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold">Vus / lus <span className="text-sm font-normal text-[var(--color-text-muted)]">· {seen.length}</span></h2>
        <PosterRow items={seen} empty="Aucune œuvre terminée pour ce filtre." />
      </section>

      <Modal open={creating} onClose={() => setCreating(false)} title="Nouvelle collection">
        <div className="flex flex-col gap-4">
          <label className="text-sm font-semibold">Nom
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="ex. Cyberpunk"
              className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm font-normal" />
          </label>
          <label className="text-sm font-semibold">Description <span className="font-normal text-[var(--color-text-muted)]">(optionnel)</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} rows={2}
              className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm font-normal" />
          </label>
          <div>
            <p className="mb-2 text-sm font-semibold">Type</p>
            <div className="flex gap-2">
              {([["films", "Films & Séries"], ["books", "Livres"], ["mixed", "Mixte"]] as const).map(([k, label]) => (
                <button key={k} onClick={() => setKind(k)}
                  className={`rounded-full border px-4 py-1.5 text-sm ${kind === k ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-[var(--color-border)] text-[var(--color-text-muted)]"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Visibilité</p>
            <div className="flex gap-2">
              {(["public", "private"] as ListVisibility[]).map((v) => (
                <button key={v} onClick={() => setVisibility(v)}
                  className={`rounded-full border px-4 py-1.5 text-sm ${visibility === v ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-[var(--color-border)] text-[var(--color-text-muted)]"}`}>
                  {v === "public" ? "Public" : "Privé"}
                </button>
              ))}
            </div>
          </div>
          <button onClick={create} disabled={busy || !name.trim()} className="rounded-full bg-[var(--color-primary)] py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? "…" : "Créer la collection"}
          </button>
        </div>
      </Modal>

      {viewing && <ListDetailModal listId={viewing} editable onClose={() => setViewing(null)} onChanged={() => load()} />}
      {scanning && <BookScanner onClose={() => setScanning(false)} onIsbn={addScannedBook} />}
    </>
  );
}
