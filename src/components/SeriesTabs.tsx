"use client";
import { useState, type ReactNode } from "react";
import { EpisodesTab } from "./EpisodesTab";
import { SeasonGrid } from "./SeasonGrid";

export function SeriesTabs({ workId, episodeCounts, initialWatched, children }: {
  workId: string; episodeCounts: number[] | null; initialWatched: number[][] | null; children: ReactNode;
}) {
  const [tab, setTab] = useState<"apercu" | "episodes">("apercu");
  const seg = (on: boolean) =>
    `flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${on ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-muted)]"}`;
  return (
    <div className="mt-4">
      <div className="mb-4 inline-flex w-full gap-1 rounded-full border border-[var(--color-border)] p-1">
        <button className={seg(tab === "apercu")} onClick={() => setTab("apercu")}>Aperçu</button>
        <button className={seg(tab === "episodes")} onClick={() => setTab("episodes")}>Épisodes</button>
      </div>
      {tab === "apercu" ? (
        <>
          <SeasonGrid workId={workId} episodeCounts={episodeCounts} initialWatched={initialWatched} />
          {children}
        </>
      ) : <EpisodesTab workId={workId} episodeCounts={episodeCounts} />}
    </div>
  );
}
