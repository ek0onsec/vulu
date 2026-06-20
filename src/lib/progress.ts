import type { EntryProgress, EntryStatus, WorkType } from "@/server/domain/entities";

interface WorkLike { type: WorkType; episodeCounts: number[] | null; pageCount: number | null }

export function formatProgress(entry: { progress: EntryProgress | null }, work: WorkLike): string | null {
  const p = entry.progress;
  if (!p) return null;
  if (work.type === "tv" && p.season && p.episode) {
    const total = work.episodeCounts?.[p.season - 1];
    return `S${p.season} E${p.episode}${total ? `/${total}` : ""}`;
  }
  if (work.type === "book") {
    const parts: string[] = [];
    if (p.tome) parts.push(`Tome ${p.tome}`);
    if (p.page) parts.push(`p.${p.page}${work.pageCount ? `/${work.pageCount}` : ""}`);
    return parts.length ? parts.join(" · ") : null;
  }
  return null;
}

export function activityVerb(status: EntryStatus, type: WorkType): string | null {
  if (status !== "in_progress") return null;
  return type === "book" ? "lit" : "regarde";
}
