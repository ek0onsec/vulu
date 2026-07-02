"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import type { PersonProfile, PersonWork, DiscoveryWork } from "@/server/application/person";
import { statusLabel } from "@/lib/status-label";

function PosterLink({ href, title, posterUrl, badge }: { href: string; title: string; posterUrl: string | null; badge?: string }) {
  return (
    <Link href={href} className="w-28 shrink-0">
      <div className="aspect-[2/3] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]"
        style={posterUrl ? { backgroundImage: `url(${posterUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} />
      <p className="mt-1.5 line-clamp-2 text-sm font-semibold">{title}</p>
      {badge && <p className="text-xs text-[var(--color-text-muted)]">{badge}</p>}
    </Link>
  );
}

export function PersonClient({ profile }: { profile: PersonProfile }) {
  const router = useRouter();
  const [opening, setOpening] = useState<string | null>(null);

  async function open(d: DiscoveryWork) {
    setOpening(d.externalId);
    try {
      const { work } = await api.post<{ work: { id: string } }>("/api/works/import", { source: d.source, externalId: d.externalId, type: d.type });
      router.push(`/work/${work.id}`);
    } catch { toast("Import impossible", "error"); setOpening(null); }
  }

  const workBadge = (w: PersonWork) =>
    w.status === "done" && w.rating ? `${w.rating.toFixed(1).replace(".", ",")}/5` : statusLabel(w.status, w.type);

  return (
    <>
      <h1 className="mb-1 font-display text-2xl font-bold">{profile.name}</h1>

      <h2 className="mb-3 mt-5 font-display text-lg font-bold">Dans ta bibliothèque</h2>
      {profile.library.length === 0
        ? <p className="text-sm text-[var(--color-text-muted)]">Aucune œuvre de cette personne dans ta bibliothèque.</p>
        : <div className="flex gap-3 overflow-x-auto pb-1">
            {profile.library.map((w) => <PosterLink key={w.workId} href={`/work/${w.workId}`} title={w.title} posterUrl={w.posterUrl} badge={workBadge(w)} />)}
          </div>}

      {profile.discovery.length > 0 && (
        <>
          <h2 className="mb-3 mt-6 font-display text-lg font-bold">À découvrir</h2>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {profile.discovery.map((d) => (
              <button key={`${d.source}-${d.externalId}`} onClick={() => open(d)} disabled={opening === d.externalId} className="w-28 shrink-0 text-left disabled:opacity-50">
                <div className="aspect-[2/3] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]"
                  style={d.posterUrl ? { backgroundImage: `url(${d.posterUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} />
                <p className="mt-1.5 line-clamp-2 text-sm font-semibold">{d.title}</p>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
