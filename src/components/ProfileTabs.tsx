"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ListDetailModal } from "./ListDetailModal";
import { Modal } from "./Modal";
import { Icon } from "./Icon";
import { api } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import type { WorkType } from "@/server/domain/entities";
import type { WorkSummary, WorkDetails } from "@/server/ports/catalog";

export interface PosterItem { id: string; workId: string; posterUrl: string | null; title: string; rating: number | null; type: WorkType }
export interface ListItem { id: string; name: string; description: string | null; visibility: "public" | "private"; bannerUrl: string | null; count: number }
export interface ShowcaseWork { workId: string; title: string; posterUrl: string | null }
interface Showcase { movie: ShowcaseWork[]; tv: ShowcaseWork[]; book: ShowcaseWork[] }
type Cat = "movie" | "tv" | "book";

function PosterGrid({ items, empty, onRemove }: { items: PosterItem[]; empty: string; onRemove?: (it: PosterItem) => void }) {
  if (items.length === 0) return <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">{empty}</p>;
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
      {items.map((it) => (
        <div key={it.id} className="group relative">
          <Link href={`/work/${it.workId}`} className="relative block aspect-[2/3] overflow-hidden rounded-xl bg-[var(--color-border)] transition-transform hover:scale-[1.03]"
            style={it.posterUrl ? { backgroundImage: `url(${it.posterUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
            {it.rating !== null && <span className="absolute bottom-1 left-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[0.65rem] font-bold text-[var(--color-accent)]">★ {it.rating.toFixed(1).replace(".", ",")}</span>}
          </Link>
          {onRemove && (
            <button onClick={() => onRemove(it)} aria-label={`Retirer ${it.title}`} className="absolute right-1 top-1 rounded-full bg-black/65 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function ShowcaseRow({ title, works }: { title: string; works: ShowcaseWork[] }) {
  if (works.length === 0) return null;
  return (
    <div className="mb-5">
      <h3 className="mb-2 text-sm font-semibold text-[var(--color-text-muted)]">{title}</h3>
      <div className="grid grid-cols-5 gap-2 sm:gap-3">
        {works.map((w) => (
          <Link key={w.workId} href={`/work/${w.workId}`} className="aspect-[2/3] overflow-hidden rounded-xl bg-[var(--color-border)] transition-transform hover:scale-[1.03]"
            style={w.posterUrl ? { backgroundImage: `url(${w.posterUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} />
        ))}
      </div>
    </div>
  );
}

export function ProfileTabs({ watched, planned, lists, isSelf, showFilms, showBooks, showcase }: {
  watched: PosterItem[]; planned: PosterItem[] | null; lists: ListItem[]; isSelf: boolean; showFilms: boolean; showBooks: boolean;
  showcase: Showcase;
}) {
  const [w, setW] = useState(watched);
  const [p, setP] = useState(planned);
  const [sc, setSc] = useState(showcase);
  const [viewing, setViewing] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);

  async function remove(it: PosterItem) {
    setW((xs) => xs.filter((x) => x.id !== it.id));
    setP((xs) => (xs ? xs.filter((x) => x.id !== it.id) : xs));
    try { await api.del("/api/works/entry", { entryId: it.id }); toast(`« ${it.title} » retiré`); }
    catch { toast("Action impossible", "error"); }
  }

  const films = (xs: PosterItem[]) => xs.filter((x) => x.type !== "book");
  const books = (xs: PosterItem[]) => xs.filter((x) => x.type === "book");
  const onRemove = isSelf ? remove : undefined;
  const showcaseEmpty = sc.movie.length + sc.tv.length + sc.book.length === 0;

  const tabs: { id: string; label: string; render: () => React.ReactNode }[] = [];
  tabs.push({
    id: "vitrine", label: "Vitrine",
    render: () => (
      <div>
        {isSelf && (
          <button onClick={() => setManaging(true)} className="mb-4 flex items-center gap-1.5 rounded-full border border-[var(--color-primary)] px-4 py-1.5 text-sm font-semibold text-[var(--color-primary)]">
            <Icon name="settings" size={16} /> Éditer ma vitrine
          </button>
        )}
        {showcaseEmpty
          ? <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">{isSelf ? "Mets en avant tes 5 films, séries et livres préférés." : "Vitrine vide pour l’instant."}</p>
          : <>
              {showFilms && <ShowcaseRow title="🎬 Films cultes" works={sc.movie} />}
              {showFilms && <ShowcaseRow title="📺 Séries cultes" works={sc.tv} />}
              {showBooks && <ShowcaseRow title="📚 Livres cultes" works={sc.book} />}
            </>}
      </div>
    ),
  });
  if (showFilms) {
    tabs.push({ id: "vus", label: "Vus", render: () => <PosterGrid items={films(w)} empty="Aucun film/série vu." onRemove={onRemove} /> });
    if (p) tabs.push({ id: "avoir", label: "À voir", render: () => <PosterGrid items={films(p)} empty="Watchlist vide." onRemove={onRemove} /> });
  }
  if (showBooks) {
    tabs.push({ id: "lus", label: "Lu", render: () => <PosterGrid items={books(w)} empty="Aucun livre lu." onRemove={onRemove} /> });
    if (p) tabs.push({ id: "alire", label: "À lire", render: () => <PosterGrid items={books(p)} empty="Aucun livre à lire." onRemove={onRemove} /> });
  }
  tabs.push({
    id: "collections", label: "Collections",
    render: () => (
      lists.length === 0
        ? <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">Aucune collection.</p>
        : <div className="grid gap-3 sm:grid-cols-2">
            {lists.map((l) => (
              <button key={l.id} onClick={() => setViewing(l.id)} className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-left transition-colors hover:border-[var(--color-primary)]">
                <div className="h-16 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)]" style={l.bannerUrl ? { backgroundImage: `url(${l.bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} />
                <div className="p-3">
                  <p className="font-semibold">{l.name}</p>
                  {l.description && <p className="truncate text-sm text-[var(--color-text)]">{l.description}</p>}
                  <p className="text-xs text-[var(--color-text-muted)]">{l.count} œuvres · {l.visibility === "public" ? "public" : "privé"}</p>
                </div>
              </button>
            ))}
          </div>
    ),
  });

  const [active, setActive] = useState(tabs[0]!.id);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  const rootRef = useRef<HTMLDivElement>(null);
  const tabIds = tabs.map((t) => t.id);
  useEffect(() => {
    const applyHash = () => {
      const id = window.location.hash.slice(1);
      if (id && tabIds.includes(id)) {
        setActive(id);
        rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabIds.join(",")]);

  return (
    <div ref={rootRef} className="mt-6">
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-[var(--color-border)]">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setActive(t.id)}
            className={`relative shrink-0 px-4 py-3 text-sm font-semibold transition-colors ${active === t.id ? "text-[var(--color-text)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"}`}>
            {t.label}
            {active === t.id && <span className="absolute inset-x-3 -bottom-px h-1 rounded-full bg-[var(--color-primary)]" />}
          </button>
        ))}
      </div>

      {current?.render()}

      {viewing && <ListDetailModal listId={viewing} editable={isSelf} onClose={() => setViewing(null)} />}
      {managing && <ShowcaseManager sc={sc} showFilms={showFilms} showBooks={showBooks} onClose={() => setManaging(false)} onChange={setSc} />}
    </div>
  );
}

function ShowcaseManager({ sc, showFilms, showBooks, onClose, onChange }: {
  sc: Showcase; showFilms: boolean; showBooks: boolean; onClose: () => void; onChange: (s: Showcase) => void;
}) {
  const [q, setQ] = useState("");
  const [domain, setDomain] = useState<"films" | "books">(showFilms ? "films" : "books");
  const [results, setResults] = useState<WorkSummary[]>([]);
  const [searching, setSearching] = useState(false);

  async function search() {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try { const d = await api.get<{ results: WorkSummary[] }>(`/api/catalog/search?q=${encodeURIComponent(q)}&domain=${domain}`); setResults(d.results); }
    catch { setResults([]); } finally { setSearching(false); }
  }

  async function persist(next: Showcase) {
    onChange(next);
    try {
      await api.put("/api/me/showcase", {
        movie: next.movie.map((x) => x.workId), tv: next.tv.map((x) => x.workId), book: next.book.map((x) => x.workId),
      });
    } catch { toast("Sauvegarde impossible", "error"); }
  }

  async function add(r: WorkSummary) {
    const cat = r.type as Cat;
    if (sc[cat].length >= 5) { toast("5 maximum dans cette catégorie"); return; }
    try {
      const { work } = await api.post<{ work: WorkDetails & { id: string } }>("/api/works/import", { source: r.source, externalId: r.externalId, type: r.type });
      if (sc[cat].some((x) => x.workId === work.id)) return;
      const next = { ...sc, [cat]: [...sc[cat], { workId: work.id, title: work.title, posterUrl: work.posterUrl }] };
      await persist(next); toast(`« ${work.title} » ajouté à ta vitrine`);
    } catch { toast("Action impossible", "error"); }
  }

  function removeFrom(cat: Cat, workId: string) {
    persist({ ...sc, [cat]: sc[cat].filter((x) => x.workId !== workId) });
  }

  const cats: { cat: Cat; label: string; show: boolean }[] = [
    { cat: "movie", label: "Films", show: showFilms },
    { cat: "tv", label: "Séries", show: showFilms },
    { cat: "book", label: "Livres", show: showBooks },
  ];

  return (
    <Modal open onClose={onClose} title="Ma vitrine (top all-time)">
      <div className="mb-4">
        {showFilms && showBooks && (
          <div className="mb-2 flex gap-2">
            {(["films", "books"] as const).map((d) => (
              <button key={d} onClick={() => { setDomain(d); setResults([]); }} className={`rounded-full border px-3 py-1 text-xs font-semibold ${domain === d ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-[var(--color-border)] text-[var(--color-text-muted)]"}`}>{d === "films" ? "Films/Séries" : "Livres"}</button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") search(); }} placeholder="Rechercher à épingler…"
            className="flex-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2 text-sm" />
          <button onClick={search} className="rounded-full bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white">Chercher</button>
        </div>
        {searching && <p className="mt-2 text-xs text-[var(--color-text-muted)]">Recherche…</p>}
        {results.length > 0 && (
          <div className="mt-2 grid grid-cols-4 gap-2">
            {results.slice(0, 8).map((r) => (
              <button key={`${r.source}-${r.externalId}`} onClick={() => add(r)} className="text-left">
                <div className="aspect-[2/3] overflow-hidden rounded-md bg-[var(--color-border)]" style={r.posterUrl ? { backgroundImage: `url(${r.posterUrl})`, backgroundSize: "cover" } : undefined} />
                <p className="mt-1 line-clamp-2 text-[0.7rem] leading-tight">{r.title}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {cats.filter((c) => c.show).map(({ cat, label }) => (
        <div key={cat} className="mb-4">
          <p className="mb-2 text-sm font-semibold">{label} <span className="text-xs font-normal text-[var(--color-text-muted)]">{sc[cat].length}/5</span></p>
          <div className="grid grid-cols-5 gap-2">
            {sc[cat].map((wk) => (
              <div key={wk.workId} className="group relative">
                <div className="aspect-[2/3] overflow-hidden rounded-md bg-[var(--color-border)]" style={wk.posterUrl ? { backgroundImage: `url(${wk.posterUrl})`, backgroundSize: "cover" } : undefined} />
                <button onClick={() => removeFrom(cat, wk.workId)} aria-label={`Retirer ${wk.title}`} className="absolute right-0.5 top-0.5 rounded-full bg-black/65 p-0.5 text-white">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
                </button>
              </div>
            ))}
            {sc[cat].length === 0 && <p className="col-span-5 text-xs text-[var(--color-text-muted)]">Rien pour l’instant.</p>}
          </div>
        </div>
      ))}
    </Modal>
  );
}
