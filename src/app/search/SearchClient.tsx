"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { TabSwitcher } from "@/components/TabSwitcher";
import type { Domain } from "@/server/domain/entities";
import type { WorkSummary, WorkDetails } from "@/server/ports/catalog";

export function SearchClient({ activeTabs }: { activeTabs: Domain[] }) {
  const router = useRouter();
  const [domain, setDomain] = useState<Domain>(activeTabs[0] ?? "films");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<WorkSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!q.trim()) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.get<{ results: WorkSummary[] }>(`/api/catalog/search?q=${encodeURIComponent(q)}&domain=${domain}`);
        setResults(data.results);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q, domain]);

  async function open(r: WorkSummary) {
    setOpening(r.externalId);
    try {
      const { work } = await api.post<{ work: WorkDetails & { id: string } }>("/api/works/import", {
        source: r.source, externalId: r.externalId, type: r.type,
      });
      router.push(`/work/${work.id}`);
    } catch {
      setOpening(null);
    }
  }

  return (
    <>
      <h1 className="font-display mb-4 text-2xl font-bold">Recherche</h1>
      {activeTabs.length > 1 && <TabSwitcher active={activeTabs} value={domain} onChange={setDomain} />}
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)}
        placeholder={domain === "books" ? "Un livre, un auteur…" : "Un film, une série…"}
        className="mb-5 w-full rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3 text-sm" />

      {loading && <p className="text-sm text-[var(--color-text-muted)]">Recherche…</p>}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {results.map((r) => (
          <button key={`${r.source}-${r.externalId}`} onClick={() => open(r)} disabled={opening === r.externalId} className="text-left">
            <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-[var(--color-border)]"
              style={r.posterUrl ? { backgroundImage: `url(${r.posterUrl})`, backgroundSize: "cover" } : undefined}>
              {opening === r.externalId && <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs text-white">…</span>}
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-[var(--color-text)]">{r.title}{r.year ? ` (${r.year})` : ""}</p>
          </button>
        ))}
      </div>
    </>
  );
}
