import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { getSeasonEpisodes } from "@/server/application/get-episodes";

const tv = { source: "tmdb" as const, externalId: "1396", type: "tv" as const };
const book = { source: "googlebooks" as const, externalId: "book-1", type: "book" as const };
let deps: Deps; let catalog: FakeCatalog;
beforeEach(() => { catalog = new FakeCatalog(); deps = makeInMemoryDeps(catalog); });

describe("getSeasonEpisodes", () => {
  it("fetch + mappe la saison au premier appel", async () => {
    const eps = await getSeasonEpisodes(deps, tv, 1);
    expect(eps).toHaveLength(2);
    expect(eps[0]).toEqual({ number: 1, title: "Pilote", airDate: "2008-01-20", overview: "Walter…" });
    expect(catalog.seasonCalls).toBe(1);
  });
  it("sert du cache au deuxième appel (catalogue appelé une seule fois)", async () => {
    await getSeasonEpisodes(deps, tv, 1);
    await getSeasonEpisodes(deps, tv, 1);
    expect(catalog.seasonCalls).toBe(1);
  });
  it("refetch quand le cache est périmé (> 7 jours)", async () => {
    await deps.episodeCache.upsert({ source: "tmdb", externalId: "1396", season: 1, episodes: [], cachedAt: new Date(0) });
    const eps = await getSeasonEpisodes(deps, tv, 1);
    expect(eps).toHaveLength(2);
    expect(catalog.seasonCalls).toBe(1);
  });
  it("retourne [] sans appel catalogue pour un livre ou une saison < 1", async () => {
    expect(await getSeasonEpisodes(deps, book, 1)).toEqual([]);
    expect(await getSeasonEpisodes(deps, tv, 0)).toEqual([]);
    expect(catalog.seasonCalls).toBe(0);
  });
  it("retombe sur le cache périmé si le catalogue échoue", async () => {
    await deps.episodeCache.upsert({
      source: "tmdb", externalId: "1396", season: 1,
      episodes: [{ number: 1, title: "Ancien", airDate: null, overview: null }], cachedAt: new Date(0),
    });
    catalog.getSeasonEpisodes = async () => { throw new Error("TMDB down"); };
    const eps = await getSeasonEpisodes(deps, tv, 1);
    expect(eps[0]?.title).toBe("Ancien");
  });
});
