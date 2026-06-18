"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { FeedCard } from "@/components/FeedCard";
import { FeedComposer } from "@/components/FeedComposer";
import type { Domain } from "@/server/domain/entities";
import type { FeedItem } from "@/server/application/feed";

type Scope = "foryou" | "circle";
const TABS: { id: Scope; label: string }[] = [
  { id: "foryou", label: "Pour vous" },
  { id: "circle", label: "Mon cercle" },
];

export function FeedClient({ displayName, avatarUrl }: { activeTabs: Domain[]; displayName: string; avatarUrl: string | null }) {
  const [scope, setScope] = useState<Scope>("foryou");
  const [items, setItems] = useState<FeedItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  const load = useCallback(async (s: Scope, fromCursor: string | null) => {
    setLoading(true);
    try {
      const url = `/api/feed?scope=${s}${fromCursor ? `&cursor=${encodeURIComponent(fromCursor)}` : ""}`;
      const data = await api.get<{ items: FeedItem[]; nextCursor: string | null }>(url);
      setItems((prev) => (fromCursor ? [...prev, ...data.items] : data.items));
      setCursor(data.nextCursor);
    } finally {
      setLoading(false); setReady(true);
    }
  }, []);

  // (re)chargement initial à chaque changement d'onglet
  useEffect(() => { setReady(false); setItems([]); setCursor(null); void load(scope, null); }, [scope, load]);

  // scroll infini : charge la page suivante quand le sentinelle entre dans le viewport
  useEffect(() => {
    if (!cursor || loading) return;
    const el = sentinel.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void load(scope, cursor);
    }, { rootMargin: "600px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [cursor, loading, scope, load]);

  return (
    <>
      <div className="mb-4 flex rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setScope(t.id)}
            className={`relative flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
              scope === t.id ? "bg-[color-mix(in_srgb,var(--color-primary)_14%,transparent)] text-[var(--color-primary)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <FeedComposer displayName={displayName} avatarUrl={avatarUrl} />

      {!ready && (
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-[var(--color-border)]" />)}</div>
      )}
      {ready && items.map((i) => <FeedCard key={i.entry.id} item={i} />)}
      {ready && items.length === 0 && !loading && (
        <p className="mt-8 text-center text-[var(--color-text-muted)]">
          {scope === "circle" ? "Ton cercle n’a rien publié récemment. Suis plus de monde !" : "Rien ici pour l’instant. Note un film ou un livre pour lancer ton feed."}
        </p>
      )}

      <div ref={sentinel} className="h-10" />
      {loading && ready && <p className="py-2 text-center text-sm text-[var(--color-text-muted)]">Chargement…</p>}
    </>
  );
}
