import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { importTvTime } from "@/server/application/import-tvtime";
import type { TvTimeExport } from "@/server/import/tvtime-parser";
import { updateEpisode } from "@/server/application/episode-entry";

let deps: Deps;
let fake: FakeCatalog;
const USER = "user-1";
beforeEach(() => {
  fake = new FakeCatalog();
  // 1396 = Breaking Bad (tv, episodeCounts [7,13]) ; 603 = The Matrix (movie, 1999)
  fake.tvdbToTmdb["999"] = "1396";
  deps = makeInMemoryDeps(fake);
});

const bbSeries: TvTimeExport = {
  series: [{ tvdbId: "999", name: "Breaking Bad", followedAt: null,
    watched: [ { season: 1, episode: 1, watchedAt: new Date("2020-01-01") },
               { season: 1, episode: 2, watchedAt: new Date("2020-01-02") } ] }],
  movies: [],
};

describe("importTvTime", () => {
  it("crée les épisodes manquants en privé et hors feed", async () => {
    const report = await importTvTime(deps, USER, bbSeries);
    expect(report.episodesAdded).toBe(2);
    expect(report.seriesImported).toBe(1);
    const ep = await deps.episodeEntries.findOne(USER, (await firstWork(deps)).id, 1, 1);
    expect(ep!.watched).toBe(true);
    expect(ep!.audiences).toEqual({ public: false, circle: false, communityIds: [] });
    expect(ep!.activityAt).toBeNull();
  });

  it("ne modifie pas un épisode déjà présent (dédup, Vulu prime)", async () => {
    // Margot a déjà coché S1E1 manuellement
    await updateEpisode(deps, USER, { source: "tmdb", externalId: "1396", type: "tv" }, 1, 1, { watched: true, watchedAt: new Date("2019-06-06") });
    const report = await importTvTime(deps, USER, bbSeries);
    expect(report.episodesSkipped).toBe(1); // S1E1 sauté
    expect(report.episodesAdded).toBe(1);   // S1E2 ajouté
    const ep = await deps.episodeEntries.findOne(USER, (await firstWork(deps)).id, 1, 1);
    expect(ep!.watchedAt).toEqual(new Date("2019-06-06")); // date d'origine conservée
  });

  it("crée une série « à voir » (planned) si aucun épisode vu et pas d'entrée", async () => {
    const report = await importTvTime(deps, USER, { series: [{ tvdbId: "999", name: "Breaking Bad", followedAt: null, watched: [] }], movies: [] });
    expect(report.seriesToWatch).toBe(1);
    const entry = await deps.entries.findByUserAndWork(USER, (await firstWork(deps)).id);
    expect(entry!.status).toBe("planned");
    expect(entry!.audiences.public).toBe(false);
  });

  it("importe un film vu (done) et le saute s'il existe déjà", async () => {
    const data: TvTimeExport = { series: [], movies: [{ name: "The Matrix", year: 1999, watchedAt: new Date("2021-03-03") }] };
    const r1 = await importTvTime(deps, USER, data);
    expect(r1.moviesImported).toBe(1);
    const entry = await deps.entries.findByUserAndWork(USER, (await firstWork(deps)).id);
    expect(entry!.status).toBe("done");
    expect(entry!.completedAt).toEqual(new Date("2021-03-03"));
    const r2 = await importTvTime(deps, USER, data); // 2e passage : skip total
    expect(r2.moviesImported).toBe(0);
  });

  it("liste les non-mappés", async () => {
    const r = await importTvTime(deps, USER, {
      series: [{ tvdbId: "inconnu", name: "Série Inconnue", followedAt: null, watched: [{ season: 1, episode: 1, watchedAt: new Date() }] }],
      movies: [{ name: "Film Inconnu", year: 2000, watchedAt: new Date() }],
    });
    expect(r.unmatched.series).toContain("Série Inconnue");
    expect(r.unmatched.movies).toContain("Film Inconnu");
  });
});

async function firstWork(deps: Deps) {
  const w = await deps.works.findByExternal("tmdb", "1396", "tv") ?? await deps.works.findByExternal("tmdb", "603", "movie");
  return w!;
}
