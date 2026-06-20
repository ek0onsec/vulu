"use client";
import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { formatProgress } from "@/lib/progress";
import type { EntryProgress, WorkSource, WorkType } from "@/server/domain/entities";

interface Item {
  entryId: string; source: WorkSource; externalId: string; title: string; posterUrl: string | null;
  type: WorkType; episodeCounts: number[] | null; pageCount: number | null; progress: EntryProgress | null;
}

export function InProgressShelf({ items }: { items: Item[] }) {
  const [state, setState] = useState(items);
  async function bump(it: Item) {
    const body: Record<string, unknown> = { ref: { source: it.source, externalId: it.externalId, type: it.type } };
    if (it.type === "tv") { body.season = it.progress?.season ?? 1; body.episode = (it.progress?.episode ?? 0) + 1; }
    else if (it.type === "book") { body.page = (it.progress?.page ?? 0) + 1; body.tome = it.progress?.tome ?? null; }
    else return;
    try {
      const { entry } = await api.put<{ entry: { progress: EntryProgress | null } }>("/api/works/progress", body);
      setState((prev) => prev.map((x) => x.entryId === it.entryId ? { ...x, progress: entry.progress } : x));
    } catch { toast("Action impossible", "error"); }
  }
  return (
    <section className="mb-6">
      <h2 className="mb-3 font-display text-lg font-bold">En cours</h2>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {state.map((it) => (
          <div key={it.entryId} className="w-32 shrink-0">
            <Link href={`/work/${it.externalId}`} className="block">
              <div className="aspect-[2/3] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]"
                style={it.posterUrl ? { backgroundImage: `url(${it.posterUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} />
              <p className="mt-1.5 line-clamp-1 text-sm font-semibold">{it.title}</p>
            </Link>
            <p className="text-xs text-[var(--color-text-muted)]">{formatProgress(it, it) ?? "Commencé"}</p>
            {it.type !== "movie" && (
              <button onClick={() => bump(it)} className="mt-1 w-full rounded-full border border-[var(--color-primary)] py-1 text-xs font-semibold text-[var(--color-primary)]">
                +1 {it.type === "book" ? "page" : "épisode"}
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
