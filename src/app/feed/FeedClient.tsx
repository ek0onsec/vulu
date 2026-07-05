"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { FeedCard } from "@/components/FeedCard";
import { FeedComposer } from "@/components/FeedComposer";
import { SearchIsland } from "@/components/SearchIsland";
import type { Domain } from "@/server/domain/entities";
import type { FeedItem } from "@/server/application/feed";
import { feedKey } from "@/server/application/feed";

// onglet = "foryou" | "following" | "c:<communityId>"
export function FeedClient({ activeTabs, displayName, avatarUrl }: { activeTabs: Domain[]; displayName: string; avatarUrl: string | null }) {
  const [tab, setTab] = useState("foryou");
  const [pinned, setPinned] = useState<{ id: string; name: string }[]>([]);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => { api.get<{ communities: { id: string; name: string }[] }>("/api/communities/pinned").then((d) => setPinned(d.communities)).catch(() => {}); }, []);

  const load = useCallback(async (t: string, fromCursor: string | null) => {
    setLoading(true);
    try {
      const url = t.startsWith("c:")
        ? `/api/communities/${t.slice(2)}/feed${fromCursor ? `?cursor=${encodeURIComponent(fromCursor)}` : ""}`
        : `/api/feed?scope=${t}${fromCursor ? `&cursor=${encodeURIComponent(fromCursor)}` : ""}`;
      const data = await api.get<{ items: FeedItem[]; nextCursor: string | null }>(url);
      setItems((prev) => (fromCursor ? [...prev, ...data.items] : data.items));
      setCursor(data.nextCursor);
    } finally {
      setLoading(false); setReady(true);
    }
  }, []);

  useEffect(() => { setReady(false); setItems([]); setCursor(null); void load(tab, null); }, [tab, load]);

  useEffect(() => {
    if (!cursor || loading) return;
    const el = sentinel.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => { if (entries[0]?.isIntersecting) void load(tab, cursor); }, { rootMargin: "600px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [cursor, loading, tab, load]);

  const tabs = [{ id: "foryou", label: "Pour toi" }, { id: "following", label: "Suivis" }, ...pinned.map((c) => ({ id: `c:${c.id}`, label: c.name }))];

  return (
    <>
      <div className="sticky top-12 z-30 mb-3 flex gap-1.5 overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 md:static md:top-auto md:z-auto md:mb-4">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`min-w-fit flex-1 whitespace-nowrap rounded-xl px-4 py-2.5 text-center text-sm font-semibold transition-colors ${tab === t.id ? "bg-[color-mix(in_srgb,var(--color-primary)_14%,transparent)] text-[var(--color-primary)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <SearchIsland activeTabs={activeTabs} />

      <div className="hidden md:block">
        <FeedComposer displayName={displayName} avatarUrl={avatarUrl} />
      </div>

      {!ready && <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-[var(--color-border)]" />)}</div>}
      {ready && items.map((i) => <FeedCard key={feedKey(i)} item={i} />)}
      {ready && items.length === 0 && !loading && (
        <p className="mt-8 text-center text-[var(--color-text-muted)]">
          {tab === "following" ? "Personne que tu suis n’a publié récemment. Suis plus de monde !" : tab.startsWith("c:") ? "Rien dans cette communauté. Partages-y un avis depuis une fiche !" : "Rien ici pour l’instant. Note un film ou un livre pour lancer ton feed."}
        </p>
      )}

      <div ref={sentinel} className="h-10" />
      {loading && ready && <p className="py-2 text-center text-sm text-[var(--color-text-muted)]">Chargement…</p>}
    </>
  );
}
