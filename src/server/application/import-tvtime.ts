import type { Deps } from "@/server/container";
import type { LibraryEntry } from "@/server/domain/entities";
import type { TvTimeExport } from "@/server/import/tvtime-parser";
import { getOrImportWork, domainOf } from "./get-work";
import { loadOrCreateEntry } from "./library-entry";
import { recomputeSeriesEntry } from "./episode-entry";

import type { ImportReport } from "@/server/domain/entities";
export type { ImportReport };

const PRIVATE = { public: false, circle: false, communityIds: [] as string[] };

export type ImportProgress = (p: { phase: "series" | "movies"; done: number; total: number }) => void | Promise<void>;

export async function importTvTime(deps: Deps, userId: string, data: TvTimeExport, onProgress?: ImportProgress): Promise<ImportReport> {
  const report: ImportReport = {
    seriesImported: 0, seriesToWatch: 0, episodesAdded: 0, episodesSkipped: 0,
    moviesImported: 0, unmatched: { series: [], movies: [] },
  };

  for (let seriesIndex = 0; seriesIndex < data.series.length; seriesIndex++) {
    const s = data.series[seriesIndex]!;
    await onProgress?.({ phase: "series", done: seriesIndex, total: data.series.length });
    const mapped = await deps.catalog.findByTvdbId(s.tvdbId);
    if (!mapped) { report.unmatched.series.push(s.name); continue; }
    const ref = { source: "tmdb" as const, externalId: mapped.externalId, type: "tv" as const };
    const work = await getOrImportWork(deps, ref);

    if (s.watched.length === 0) {
      const existing = await deps.entries.findByUserAndWork(userId, work.id);
      if (!existing) {
        await deps.entries.upsert(await loadOrCreateEntry(deps, userId, ref)); // planned privé par défaut
        report.seriesToWatch++;
      }
      continue;
    }

    let added = 0;
    for (const w of s.watched) {
      const ex = await deps.episodeEntries.findOne(userId, work.id, w.season, w.episode);
      if (ex) { report.episodesSkipped++; continue; }
      const now = deps.clock.now();
      await deps.episodeEntries.upsert({
        id: deps.ids.next(), userId, workId: work.id, season: w.season, episode: w.episode,
        watched: true, watchedAt: w.watchedAt, rating: null, text: null,
        audiences: { ...PRIVATE }, activityAt: null, createdAt: now, updatedAt: now,
      });
      added++; report.episodesAdded++;
    }
    if (added > 0) { await recomputeSeriesEntry(deps, userId, ref, work); report.seriesImported++; }
  }

  for (let movieIndex = 0; movieIndex < data.movies.length; movieIndex++) {
    const m = data.movies[movieIndex]!;
    await onProgress?.({ phase: "movies", done: movieIndex, total: data.movies.length });
    const mapped = await deps.catalog.findMovieByTitleYear(m.name, m.year);
    if (!mapped) { report.unmatched.movies.push(m.name); continue; }
    const ref = { source: "tmdb" as const, externalId: mapped.externalId, type: "movie" as const };
    const work = await getOrImportWork(deps, ref);
    const existing = await deps.entries.findByUserAndWork(userId, work.id);
    if (existing) continue; // skip total
    const base = await loadOrCreateEntry(deps, userId, ref);
    const now = deps.clock.now();
    const entry: LibraryEntry = {
      ...base, domain: domainOf(work.type), status: "done", completedAt: m.watchedAt,
      audiences: { ...PRIVATE }, activityAt: null, updatedAt: now,
    };
    await deps.entries.upsert(entry);
    report.moviesImported++;
  }

  return report;
}

/** Exécute un import en tâche de fond, en reflétant l'avancement dans le job. */
export async function runImportJob(deps: Deps, jobId: string, userId: string, data: TvTimeExport): Promise<void> {
  try {
    const start = await deps.importJobs.findById(jobId);
    if (!start) throw new Error(`Job introuvable: ${jobId}`);
    await deps.importJobs.update({ ...start, status: "running", updatedAt: deps.clock.now() });

    let last = 0;
    const onProgress: ImportProgress = async (p) => {
      if (p.done !== p.total && p.done - last < 5) return; // throttle des écritures Mongo
      last = p.done;
      const cur = await deps.importJobs.findById(jobId);
      if (cur) await deps.importJobs.update({ ...cur, phase: p.phase, done: p.done, total: p.total, updatedAt: deps.clock.now() });
    };

    const report = await importTvTime(deps, userId, data, onProgress);
    const end = await deps.importJobs.findById(jobId);
    if (end) await deps.importJobs.update({ ...end, status: "done", report, updatedAt: deps.clock.now() });
  } catch (e) {
    const cur = await deps.importJobs.findById(jobId);
    if (cur) await deps.importJobs.update({ ...cur, status: "error", error: e instanceof Error ? e.message : String(e), updatedAt: deps.clock.now() });
  }
}
