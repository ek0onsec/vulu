import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { setEntryStatus, rateOrReviewWork, updateProgress } from "@/server/application/library-entry";
import { computeWatchMinutes } from "@/server/application/watch-time";

let deps: Deps;
beforeEach(() => { deps = makeInMemoryDeps(new FakeCatalog()); });

const movie = { source: "tmdb" as const, externalId: "603", type: "movie" as const };
const tv = { source: "tmdb" as const, externalId: "1396", type: "tv" as const };

describe("computeWatchMinutes", () => {
  it("film terminé = sa durée (136 min)", async () => {
    await rateOrReviewWork(deps, "u1", movie, { rating: 4, text: null, audiences: { public: false, circle: false, communityIds: [] } });
    expect(await computeWatchMinutes(deps, "u1")).toBe(136);
  });
  it("ignore les œuvres planned", async () => {
    await setEntryStatus(deps, "u1", movie, "planned");
    expect(await computeWatchMinutes(deps, "u1")).toBe(0);
  });
  it("série terminée = tous les épisodes × durée (20 × 47)", async () => {
    await setEntryStatus(deps, "u1", tv, "done");
    expect(await computeWatchMinutes(deps, "u1")).toBe(20 * 47);
  });
  it("série en cours = épisodes cumulés × durée (S2E3 → 7+3=10 × 47)", async () => {
    await updateProgress(deps, "u1", tv, { season: 2, episode: 3 });
    expect(await computeWatchMinutes(deps, "u1")).toBe(10 * 47);
  });
  it("ignore un runtime manquant sans appel TMDB (pas de backfill au rendu profil)", async () => {
    await rateOrReviewWork(deps, "u1", movie, { rating: 4, text: null, audiences: { public: false, circle: false, communityIds: [] } });
    const work = await deps.works.findByExternal("tmdb", "603");
    await deps.works.upsert({ ...work!, runtime: null }); // œuvre importée avant le champ runtime
    expect(await computeWatchMinutes(deps, "u1")).toBe(0); // non compté ; le backfill se fait ailleurs (page œuvre)
  });
});
