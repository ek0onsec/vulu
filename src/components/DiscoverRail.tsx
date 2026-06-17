"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import type { DiscoverResult } from "@/server/application/discover";

export function DiscoverRail() {
  const [data, setData] = useState<DiscoverResult | null>(null);
  const [followed, setFollowed] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.get<DiscoverResult>("/api/discover").then(setData).catch(() => setData({ suggestions: [], trending: [] }));
  }, []);

  async function follow(username: string, id: string) {
    setFollowed((s) => new Set(s).add(id));
    await api.post(`/api/users/${username}/follow`).catch(() => setFollowed((s) => { const n = new Set(s); n.delete(id); return n; }));
  }

  if (!data) return null;

  return (
    <div className="flex flex-col gap-5">
      {data.suggestions.length > 0 && (
        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold"><Icon name="user-plus" size={18} /> À suivre</h2>
          <ul className="flex flex-col gap-3">
            {data.suggestions.map((u) => (
              <li key={u.id} className="flex items-center gap-2.5">
                <Avatar name={u.displayName} src={u.avatarUrl} size={36} />
                <Link href={`/u/${u.username}`} className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{u.displayName}</p>
                  <p className="truncate text-xs text-[var(--color-text-muted)]">@{u.username}</p>
                </Link>
                <button onClick={() => follow(u.username, u.id)} disabled={followed.has(u.id)}
                  className="rounded-full bg-[var(--color-primary)] px-3 py-1 text-xs font-semibold text-white disabled:opacity-50">
                  {followed.has(u.id) ? "Suivi" : "Suivre"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.trending.length > 0 && (
        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold"><Icon name="trending" size={18} /> Tendances</h2>
          <ul className="flex flex-col gap-3">
            {data.trending.map((t) => (
              <li key={t.work.id}>
                <Link href={`/work/${t.work.id}`} className="flex items-center gap-3">
                  <div className="h-14 w-10 shrink-0 overflow-hidden rounded-md bg-[var(--color-border)]"
                    style={t.work.posterUrl ? { backgroundImage: `url(${t.work.posterUrl})`, backgroundSize: "cover" } : undefined} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{t.work.title}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{t.reviews} avis</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
