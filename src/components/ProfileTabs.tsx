"use client";
import { useState } from "react";
import Link from "next/link";
import { ListDetailModal } from "./ListDetailModal";
import type { WorkType } from "@/server/domain/entities";

export interface PosterItem { id: string; workId: string; posterUrl: string | null; title: string; rating: number | null; type: WorkType }
export interface ListItem { id: string; name: string; description: string | null; visibility: "public" | "private"; count: number }

function PosterGrid({ items, empty }: { items: PosterItem[]; empty: string }) {
  if (items.length === 0) return <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">{empty}</p>;
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
      {items.map((it) => (
        <Link key={it.id} href={`/work/${it.workId}`}
          className="relative aspect-[2/3] overflow-hidden rounded-xl bg-[var(--color-border)] transition-transform hover:scale-[1.03]"
          style={it.posterUrl ? { backgroundImage: `url(${it.posterUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
          {it.rating !== null && (
            <span className="absolute bottom-1 left-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[0.65rem] font-bold text-[var(--color-accent)]">
              ★ {it.rating.toFixed(1).replace(".", ",")}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}

export function ProfileTabs({ watched, planned, lists, isSelf, showFilms, showBooks }: {
  watched: PosterItem[]; planned: PosterItem[] | null; lists: ListItem[]; isSelf: boolean; showFilms: boolean; showBooks: boolean;
}) {
  const films = (xs: PosterItem[]) => xs.filter((x) => x.type !== "book");
  const books = (xs: PosterItem[]) => xs.filter((x) => x.type === "book");

  const tabs: { id: string; label: string; render: () => React.ReactNode }[] = [];
  if (showFilms) {
    tabs.push({ id: "vus", label: "Vus", render: () => <PosterGrid items={films(watched)} empty="Aucun film/série vu." /> });
    if (planned) tabs.push({ id: "avoir", label: "À voir", render: () => <PosterGrid items={films(planned)} empty="Watchlist vide." /> });
  }
  if (showBooks) {
    tabs.push({ id: "lus", label: "Lu", render: () => <PosterGrid items={books(watched)} empty="Aucun livre lu." /> });
    if (planned) tabs.push({ id: "alire", label: "À lire", render: () => <PosterGrid items={books(planned)} empty="Aucun livre à lire." /> });
  }
  tabs.push({
    id: "collections", label: "Collections",
    render: () => (
      lists.length === 0
        ? <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">Aucune collection.</p>
        : <div className="flex flex-col gap-3">
            {lists.map((l) => (
              <button key={l.id} onClick={() => setViewing(l.id)}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-left transition-colors hover:border-[var(--color-primary)]">
                <p className="font-semibold">{l.name}</p>
                {l.description && <p className="truncate text-sm text-[var(--color-text)]">{l.description}</p>}
                <p className="text-xs text-[var(--color-text-muted)]">{l.count} œuvres · {l.visibility === "public" ? "public" : "privé"}</p>
              </button>
            ))}
          </div>
    ),
  });

  const [active, setActive] = useState(tabs[0]?.id ?? "collections");
  const [viewing, setViewing] = useState<string | null>(null);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div className="mt-6">
      <div className="mb-4 flex gap-1 border-b border-[var(--color-border)]">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setActive(t.id)}
            className={`relative px-4 py-3 text-sm font-semibold transition-colors ${
              active === t.id ? "text-[var(--color-text)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}>
            {t.label}
            {active === t.id && <span className="absolute inset-x-3 -bottom-px h-1 rounded-full bg-[var(--color-primary)]" />}
          </button>
        ))}
      </div>

      {current?.render()}

      {viewing && <ListDetailModal listId={viewing} editable={isSelf} onClose={() => setViewing(null)} />}
    </div>
  );
}
