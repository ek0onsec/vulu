"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { toast } from "@/lib/toast";

export function SeasonGrid({ workId, episodeCounts, initialWatched }: {
  workId: string; episodeCounts: number[] | null; initialWatched: number[][] | null;
}) {
  const router = useRouter();
  const seasons = episodeCounts ?? [];
  const [watched, setWatched] = useState<number[][]>(() => seasons.map((_, i) => [...(initialWatched?.[i] ?? [])]));
  const [busy, setBusy] = useState(false);
  if (!seasons.length) return null;

  async function put(season: number, episode: number, on: boolean) {
    setBusy(true);
    try { await api.put(`/api/works/${workId}/episodes`, { season, episode, watched: on }); router.refresh(); }
    catch { toast("Action impossible", "error"); }
    finally { setBusy(false); }
  }
  function toggle(si: number, ep: number) {
    const on = !(watched[si]?.includes(ep));
    setWatched((prev) => {
      const next = prev.map((s) => [...s]);
      while (next.length <= si) next.push([]);
      const arr = next[si]!;
      const idx = arr.indexOf(ep);
      if (idx >= 0) arr.splice(idx, 1); else arr.push(ep);
      arr.sort((a, b) => a - b);
      return next;
    });
    void put(si + 1, ep, on);
  }
  async function toggleSeason(si: number, count: number, fill: boolean) {
    setWatched((prev) => { const next = prev.map((s) => [...s]); while (next.length <= si) next.push([]); next[si] = fill ? Array.from({ length: count }, (_, k) => k + 1) : []; return next; });
    setBusy(true);
    try { for (let ep = 1; ep <= count; ep++) await api.put(`/api/works/${workId}/episodes`, { season: si + 1, episode: ep, watched: fill }); router.refresh(); }
    catch { toast("Action impossible", "error"); } finally { setBusy(false); }
  }

  return (
    <section className="mb-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Cocher les épisodes vus</p>
      <div className="flex flex-col gap-3">
        {seasons.map((count, si) => {
          const done = watched[si]?.length ?? 0;
          return (
            <div key={si} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Saison {si + 1}<span className="ml-2 text-xs font-normal text-[var(--color-text-muted)]">{done}/{count}</span></span>
                <button disabled={busy} onClick={() => toggleSeason(si, count, done !== count)}
                  className="rounded-full border border-[var(--color-border)] px-3 py-0.5 text-xs font-semibold text-[var(--color-text-muted)] disabled:opacity-50">
                  {done === count ? "Tout décocher" : "Tout cocher"}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: count }, (_, k) => k + 1).map((ep) => {
                  const on = watched[si]?.includes(ep) ?? false;
                  return (
                    <button key={ep} disabled={busy} onClick={() => toggle(si, ep)}
                      className={`h-8 min-w-8 rounded-full border px-2 text-sm font-semibold disabled:opacity-50 ${on ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-[var(--color-border)] text-[var(--color-text-muted)]"}`}>
                      {on ? "✓" : ""}{ep}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
