"use client";
import { useState } from "react";
import Link from "next/link";
import { ListDetailModal } from "./ListDetailModal";

export interface PosterItem { id: string; workId: string; posterUrl: string | null; title: string; rating: number | null }
export interface ListItem { id: string; name: string; description: string | null; visibility: "public" | "private"; count: number }

type Filter = "watched" | "planned" | "lists";

function PosterGrid({ items, empty }: { items: PosterItem[]; empty: string }) {
  if (items.length === 0) return <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">{empty}</p>;
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
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

export function ProfileTabs({ watched, planned, lists, isSelf }: {
  watched: PosterItem[]; planned: PosterItem[] | null; lists: ListItem[]; isSelf: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("watched");
  const [viewing, setViewing] = useState<string | null>(null);

  const chips: { id: Filter; label: string }[] = [
    { id: "watched", label: "Vus" },
    ...(planned ? [{ id: "planned" as Filter, label: "À voir" }] : []),
    { id: "lists", label: "Listes" },
  ];

  return (
    <div className="mt-6">
      <div className="mb-4 flex gap-2">
        {chips.map((c) => (
          <button key={c.id} onClick={() => setFilter(c.id)}
            className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
              filter === c.id ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]"
            }`}>
            {c.label}
          </button>
        ))}
      </div>

      {filter === "watched" && <PosterGrid items={watched} empty="Aucune œuvre vue pour l’instant." />}
      {filter === "planned" && planned && <PosterGrid items={planned} empty="Ta liste « à voir » est vide." />}
      {filter === "lists" && (
        lists.length === 0
          ? <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">Aucune liste.</p>
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
      )}

      {viewing && <ListDetailModal listId={viewing} editable={isSelf} onClose={() => setViewing(null)} />}
    </div>
  );
}
