"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { FeedCard } from "@/components/FeedCard";
import { FeedComposer } from "@/components/FeedComposer";
import { TabSwitcher } from "@/components/TabSwitcher";
import type { Domain } from "@/server/domain/entities";
import type { FeedItem } from "@/server/application/feed";

export function FeedClient({ activeTabs, displayName, avatarUrl }: { activeTabs: Domain[]; displayName: string; avatarUrl: string | null }) {
  const [tab, setTab] = useState<Domain>(activeTabs[0] ?? "films");
  const [items, setItems] = useState<FeedItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  const load = useCallback(async (reset: boolean, fromCursor: string | null) => {
    setLoading(true);
    try {
      const url = `/api/feed${fromCursor && !reset ? `?cursor=${encodeURIComponent(fromCursor)}` : ""}`;
      const data = await api.get<{ items: FeedItem[]; nextCursor: string | null }>(url);
      setItems((prev) => (reset ? data.items : [...prev, ...data.items]));
      setCursor(data.nextCursor);
    } finally {
      setLoading(false);
      setReady(true);
    }
  }, []);

  useEffect(() => { void load(true, null); }, [load]);

  const visible = items.filter((i) => i.entry.domain === tab);
  return (
    <>
      <FeedComposer displayName={displayName} avatarUrl={avatarUrl} />
      <TabSwitcher active={activeTabs} value={tab} onChange={setTab} />
      {!ready && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-[var(--color-border)]" />)}
        </div>
      )}
      {ready && visible.map((i) => <FeedCard key={i.entry.id} item={i} />)}
      {ready && visible.length === 0 && !loading && (
        <p className="mt-8 text-center text-[var(--color-text-muted)]">
          Rien ici pour l’instant. Suis des amis ou note un film pour remplir ton feed.
        </p>
      )}
      {cursor && (
        <button
          onClick={() => load(false, cursor)} disabled={loading}
          className="mt-2 w-full rounded-full border border-[var(--color-border)] py-2 text-sm text-[var(--color-text-muted)] disabled:opacity-50"
        >
          {loading ? "…" : "Charger plus"}
        </button>
      )}
    </>
  );
}
