import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { rateOrReviewWork } from "@/server/application/library-entry";
import { getPersonProfile } from "@/server/application/person";

let deps: Deps;
beforeEach(() => { deps = makeInMemoryDeps(new FakeCatalog()); });

describe("getPersonProfile", () => {
  it("liste les œuvres de la personne dans ma bibliothèque", async () => {
    // The Matrix (603) a Keanu Reeves (6384) dans FakeCatalog.
    await rateOrReviewWork(deps, "u1", { source: "tmdb", externalId: "603", type: "movie" }, { rating: 5, text: null, audiences: { public: true, circle: true, communityIds: [] } });
    const p = await getPersonProfile(deps, "u1", { source: "tmdb", externalId: 6384, name: "Keanu Reeves" });
    expect(p.library.map((w) => w.externalId)).toEqual(["603"]);
    expect(p.library[0]?.status).toBe("done");
  });
  it("exclut de la découverte les œuvres déjà possédées", async () => {
    await rateOrReviewWork(deps, "u1", { source: "tmdb", externalId: "603", type: "movie" }, { rating: 5, text: null, audiences: { public: true, circle: true, communityIds: [] } });
    const p = await getPersonProfile(deps, "u1", { source: "tmdb", externalId: 6384, name: "Keanu Reeves" });
    // getPersonCredits(6384) = [603, 1396] ; 603 est possédé → découverte = [1396]
    expect(p.discovery.map((w) => w.externalId)).toEqual(["1396"]);
  });
  it("branche livres : recherche par auteur", async () => {
    const p = await getPersonProfile(deps, "u1", { source: "book", externalId: 99, name: "William Gibson" });
    expect(Array.isArray(p.discovery)).toBe(true); // searchWorks("inauthor:William Gibson","books")
    expect(p.name).toBe("William Gibson");
  });
});
