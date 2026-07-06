"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { RatingSlider } from "./RatingSlider";

interface EpisodeSummary { number: number; title: string | null; airDate: string | null; overview: string | null }
interface EpisodeEntry { season: number; episode: number; watched: boolean; watchedAt: string | null; rating: number | null; text: string | null; audiences: { public: boolean; circle: boolean; communityIds: string[] }; activityAt: string | null }
interface SeasonData { episodes: EpisodeSummary[]; entries: EpisodeEntry[] }

export function EpisodesTab({ workId, episodeCounts }: { workId: string; episodeCounts: number[] | null }) {
  const router = useRouter();
  const seasons = episodeCounts ?? [];
  const [open, setOpen] = useState<number | null>(seasons.length ? 1 : null);
  const [data, setData] = useState<Record<number, SeasonData>>({});
  const [communities, setCommunities] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => { api.get<{ communities: { id: string; name: string }[] }>("/api/communities/mine").then((d) => setCommunities(d.communities)).catch(() => {}); }, []);

  // Charge la saison ouverte (au montage — saison 1 par défaut — et à chaque ouverture),
  // sans dépendre du clic, sinon le premier rendu reste bloqué sur « Chargement… ».
  useEffect(() => {
    if (open === null || data[open]) return;
    let cancelled = false;
    api.get<SeasonData>(`/api/works/${workId}/seasons/${open}`)
      .then((d) => { if (!cancelled) setData((prev) => ({ ...prev, [open]: d })); })
      .catch(() => toast("Chargement impossible", "error"));
    return () => { cancelled = true; };
  }, [open, workId, data]);

  function toggleSeason(season: number) {
    setOpen((cur) => (cur === season ? null : season));
  }

  function entryFor(season: number, episode: number): EpisodeEntry | undefined {
    return data[season]?.entries.find((e) => e.episode === episode);
  }

  async function patch(season: number, episode: number, body: Record<string, unknown>) {
    try {
      const { entry } = await api.put<{ entry: EpisodeEntry }>(`/api/works/${workId}/episodes`, { season, episode, ...body });
      setData((prev) => {
        const sd = prev[season]; if (!sd) return prev;
        const entries = [...sd.entries.filter((e) => e.episode !== episode), entry];
        return { ...prev, [season]: { ...sd, entries } };
      });
      router.refresh(); // met à jour le statut dérivé (En cours / Vu) affiché ailleurs sur la page
    } catch { toast("Action impossible", "error"); }
  }

  if (!seasons.length) return <p className="text-sm text-[var(--color-text-muted)]">Épisodes indisponibles pour cette série.</p>;

  return (
    <div className="flex flex-col gap-3">
      {seasons.map((count, si) => {
        const season = si + 1;
        const sd = data[season];
        return (
          <div key={season} className="overflow-hidden rounded-2xl border border-[var(--color-border)]">
            <button onClick={() => toggleSeason(season)} className="flex w-full items-center justify-between px-4 py-3 text-left font-display font-bold">
              Saison {season} <span className="text-xs font-normal text-[var(--color-text-muted)]">{count} épisodes</span>
            </button>
            {open === season && (
              <div className="border-t border-[var(--color-border)] p-3">
                {!sd ? <p className="text-sm text-[var(--color-text-muted)]">Chargement…</p> : (
                  <ul className="flex flex-col gap-3">
                    {Array.from({ length: count }, (_, k) => k + 1).map((ep) => {
                      const meta = sd.episodes.find((e) => e.number === ep);
                      const entry = entryFor(season, ep);
                      return (
                        <li key={ep} className="rounded-xl border border-[var(--color-border)] p-3">
                          <div className="flex items-start gap-3">
                            <button aria-label={entry?.watched ? "Marquer non vu" : "Marquer vu"}
                              onClick={() => patch(season, ep, { watched: !entry?.watched })}
                              className={`mt-0.5 h-6 w-6 shrink-0 rounded-full border text-sm font-bold ${entry?.watched ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-[var(--color-border)] text-transparent"}`}>
                              ✓
                            </button>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold">{season}×{String(ep).padStart(2, "0")}{meta?.title ? ` · ${meta.title}` : ""}
                                {meta?.airDate ? <span className="ml-1 font-normal text-[var(--color-text-muted)]">· {new Date(meta.airDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}</span> : null}
                              </p>
                              {meta?.overview && <p className="mt-1 line-clamp-3 text-sm text-[var(--color-text-muted)]">{meta.overview}</p>}
                              <div className="mt-2">
                                <RatingSlider value={entry?.rating ?? 0} onChange={(v) => patch(season, ep, { rating: v > 0 ? v : null })} />
                              </div>
                              {entry?.watched && (
                                <input type="date" value={entry.watchedAt ? entry.watchedAt.slice(0, 10) : ""}
                                  onChange={(e) => patch(season, ep, { watchedAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
                                  className="mt-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1 text-xs" />
                              )}
                              <textarea defaultValue={entry?.text ?? ""} placeholder="Ton commentaire…"
                                onBlur={(e) => { const v = e.target.value.trim(); if (v !== (entry?.text ?? "")) patch(season, ep, { text: v || null }); }}
                                className="mt-2 min-h-9 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-sm" />
                              {(entry?.rating != null || (entry?.text && entry.text.length > 0)) && (
                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                  <span className="text-xs text-[var(--color-text-muted)]">Partager :</span>
                                  {([["public", "● Public"], ["circle", "● Cercle"]] as const).map(([key, label]) => {
                                    const on = key === "public" ? !!entry?.audiences?.public : !!entry?.audiences?.circle;
                                    return (
                                      <button key={key} onClick={() => patch(season, ep, { audiences: {
                                        public: key === "public" ? !on : !!entry?.audiences?.public,
                                        circle: key === "circle" ? !on : !!entry?.audiences?.circle,
                                        communityIds: entry?.audiences?.communityIds ?? [],
                                      } })}
                                        className={`rounded-full border px-3 py-1 text-xs ${on ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-[var(--color-border)] text-[var(--color-text-muted)]"}`}>
                                        {on ? "✓ " : ""}{label}
                                      </button>
                                    );
                                  })}
                                  {communities.map((c) => {
                                    const on = entry?.audiences?.communityIds?.includes(c.id) ?? false;
                                    return (
                                      <button key={c.id} onClick={() => patch(season, ep, { audiences: {
                                        public: !!entry?.audiences?.public, circle: !!entry?.audiences?.circle,
                                        communityIds: on ? (entry?.audiences?.communityIds ?? []).filter((x) => x !== c.id) : [...(entry?.audiences?.communityIds ?? []), c.id],
                                      } })}
                                        className={`rounded-full border px-3 py-1 text-xs ${on ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-[var(--color-border)] text-[var(--color-text-muted)]"}`}>
                                        {on ? "✓ " : ""}◆ {c.name}
                                      </button>
                                    );
                                  })}
                                  {entry?.activityAt && <span className="text-xs font-semibold text-[var(--color-primary)]">✓ partagé</span>}
                                </div>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
