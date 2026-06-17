"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { FeedCard } from "./FeedCard";
import type { FeedItem } from "@/server/application/feed";

export function WorkReviews({ workId }: { workId: string }) {
  const [reviews, setReviews] = useState<FeedItem[] | null>(null);

  useEffect(() => {
    api.get<{ reviews: FeedItem[] }>(`/api/works/${workId}/reviews`)
      .then((d) => setReviews(d.reviews)).catch(() => setReviews([]));
  }, [workId]);

  return (
    <section className="mt-6">
      <h2 className="mb-3 font-display text-lg font-bold">Avis de la communauté</h2>
      {reviews === null && (
        <div className="space-y-3">
          {[0, 1].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-[var(--color-border)]" />)}
        </div>
      )}
      {reviews?.length === 0 && (
        <p className="rounded-2xl border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-text-muted)]">
          Aucun avis pour l’instant. Sois le premier à partager le tien.
        </p>
      )}
      {reviews?.map((r) => <FeedCard key={r.entry.id} item={r} />)}
    </section>
  );
}
