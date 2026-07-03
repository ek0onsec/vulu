"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { FeedCard } from "./FeedCard";
import type { FeedItem } from "@/server/application/feed";

export function WorkReviews({ workId }: { workId: string }) {
  const [data, setData] = useState<{ mine: FeedItem | null; others: FeedItem[] } | null>(null);

  useEffect(() => {
    api.get<{ mine: FeedItem | null; others: FeedItem[] }>(`/api/works/${workId}/reviews`)
      .then(setData).catch(() => setData({ mine: null, others: [] }));
  }, [workId]);

  const empty = data !== null && data.mine === null && data.others.length === 0;

  return (
    <section className="mt-6">
      <h2 className="mb-3 font-display text-lg font-bold">Avis</h2>
      {data === null && (
        <div className="space-y-3">
          {[0, 1].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-[var(--color-border)]" />)}
        </div>
      )}
      {empty && (
        <p className="rounded-2xl border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-text-muted)]">
          Aucun avis pour l’instant. Sois le premier à partager le tien.
        </p>
      )}
      {data?.mine && (
        <div className="mb-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">Ton avis</p>
          <FeedCard item={data.mine} />
        </div>
      )}
      {data?.others.map((r) => <FeedCard key={r.entry.id} item={r} />)}
    </section>
  );
}
