"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { TabSwitcher } from "@/components/TabSwitcher";
import { Avatar } from "@/components/Avatar";
import { CertifiedBadge } from "@/components/CertifiedBadge";
import { StaffBadge } from "@/components/StaffBadge";
import { Icon } from "@/components/Icon";
import { toast } from "@/lib/toast";
import { BookScanner } from "@/components/BookScanner";
import type { Domain } from "@/server/domain/entities";
import type { WorkSummary, WorkDetails } from "@/server/ports/catalog";
import type { UserSearchResult } from "@/server/application/search-users";

export function SearchPanel({ activeTabs, autoFocus = true, initialQuery, initialDomain }: { activeTabs: Domain[]; autoFocus?: boolean; initialQuery?: string; initialDomain?: Domain }) {
  const router = useRouter();
  const [domain, setDomain] = useState<Domain>(initialDomain && activeTabs.includes(initialDomain) ? initialDomain : (activeTabs[0] ?? "films"));
  const [q, setQ] = useState(initialQuery ?? "");
  const [results, setResults] = useState<WorkSummary[]>([]);
  const [members, setMembers] = useState<UserSearchResult[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const trimmed = q.trim();
    const isMemberMode = trimmed.startsWith("@");
    const memberQuery = isMemberMode ? trimmed.slice(1).trim() : "";
    const catalogQuery = isMemberMode ? memberQuery : trimmed;
    if (!isMemberMode) setMembers([]);
    // Recherche « intelligente » : elle ne part qu'après une pause de frappe (debounce ci-dessous)
    // et à partir de 2 caractères pour le catalogue — évite une requête API par lettre isolée.
    const runMember = isMemberMode && memberQuery.length >= 1;
    const runCatalog = catalogQuery.length >= 2;
    timer.current = setTimeout(async () => {
      // Reflète q/domaine dans l'URL sans navigation Next : history.replaceState met à jour
      // la barre d'adresse (URL partageable) sans refetch du composant serveur ni re-render de
      // l'arbre React. Un router.replace() ici relançait la page serveur à chaque frappe et
      // déplaçait le curseur de l'input contrôlé sur mobile (composition IME).
      const params = new URLSearchParams();
      if (trimmed) params.set("q", trimmed);
      params.set("domain", domain);
      window.history.replaceState(null, "", `/search?${params.toString()}`);

      if (!runMember && !runCatalog) { setResults([]); if (isMemberMode) setMembers([]); return; }
      setLoading(true);
      try {
        if (runMember) {
          const m = await api.get<{ users: UserSearchResult[] }>(`/api/users/search?q=${encodeURIComponent(memberQuery)}`);
          setMembers(m.users);
        }
        if (runCatalog) {
          const data = await api.get<{ results: WorkSummary[]; unavailable?: boolean }>(`/api/catalog/search?q=${encodeURIComponent(catalogQuery)}&domain=${domain}`);
          setResults(data.results);
          setUnavailable(Boolean(data.unavailable));
        } else {
          setResults([]);
        }
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

  async function handleIsbn(isbn: string) {
    try {
      const { result } = await api.get<{ result: WorkSummary | null }>(`/api/catalog/isbn?isbn=${encodeURIComponent(isbn)}`);
      if (result) { setScanning(false); await open(result); }
      else toast("Aucun livre trouvé pour ce code-barres", "error");
    } catch {
      toast("Recherche indisponible, réessaie", "error");
    }
  }

  return (
    <>
      <h1 className="font-display mb-4 text-2xl font-bold">Recherche</h1>
      {activeTabs.length > 1 && <TabSwitcher active={activeTabs} value={domain} onChange={setDomain} />}
      <div className="mb-5 flex items-center gap-2">
        <input autoFocus={autoFocus} value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={domain === "books" ? "Un livre, un auteur, @pseudo…" : "Un film, une série, @pseudo…"}
          data-tour="search-input"
          className="w-full min-w-0 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3 text-sm" />
        {domain === "books" && (
          <button type="button" onClick={() => setScanning(true)} aria-label="Scanner un code-barres"
            className="shrink-0 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]">
            <Icon name="camera" size={20} />
          </button>
        )}
      </div>
      {scanning && <BookScanner onClose={() => setScanning(false)} onIsbn={handleIsbn} />}

      {loading && <p className="text-sm text-[var(--color-text-muted)]">Recherche…</p>}
      {unavailable && !loading && (
        <p className="rounded-xl border border-dashed border-[var(--color-border)] p-4 text-sm text-[var(--color-text-muted)]">
          {domain === "books"
            ? "Catalogue livres momentanément indisponible (limite Google Books). Ajoute une clé GOOGLE_BOOKS_API_KEY pour fiabiliser."
            : "Catalogue momentanément indisponible. Réessaie dans un instant."}
        </p>
      )}
      {members.length > 0 && (
        <section className="mb-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Membres</p>
          <ul className="flex flex-col gap-1">
            {members.map((u) => (
              <li key={u.id}>
                <Link href={`/u/${u.username}`} className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-[var(--color-surface)]">
                  <Avatar name={u.displayName} src={u.avatarUrl} size={40} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 text-sm font-semibold">
                      {u.displayName}
                      {u.staff && <StaffBadge />}
                      {u.plus && <CertifiedBadge />}
                    </span>
                    <span className="block truncate text-xs text-[var(--color-text-muted)]">@{u.username}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
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
