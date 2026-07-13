import { describe, it, expect } from "vitest";
import { TmdbCatalog } from "@/server/adapters/catalog/tmdb-catalog";

function fakeFetch(bodyFor: (url: string) => unknown): typeof fetch {
  return (async (url: string) => ({
    ok: true,
    json: async () => bodyFor(url),
  })) as unknown as typeof fetch;
}
const cfg = { apiKey: "k", baseUrl: "https://api.themoviedb.org/3", imageBase: "https://img" };

describe("TmdbCatalog mapping", () => {
  it("findByTvdbId renvoie l'id TMDB de la 1re série", async () => {
    const c = new TmdbCatalog(cfg, fakeFetch((u) => u.includes("/find/73762") ? { tv_results: [{ id: 1416 }] } : {}));
    expect(await c.findByTvdbId("73762")).toEqual({ externalId: "1416" });
  });
  it("findByTvdbId renvoie null si aucune série", async () => {
    const c = new TmdbCatalog(cfg, fakeFetch(() => ({ tv_results: [] })));
    expect(await c.findByTvdbId("000")).toBeNull();
  });
  it("findMovieByTitleYear passe le titre et l'année et renvoie le 1er résultat", async () => {
    let seen = "";
    const c = new TmdbCatalog(cfg, fakeFetch((u) => { seen = u; return { results: [{ id: 131631 }] }; }));
    expect(await c.findMovieByTitleYear("Mockingjay", 2014)).toEqual({ externalId: "131631" });
    expect(seen).toContain("/search/movie");
    expect(seen).toContain("year=2014");
  });
  it("findMovieByTitleYear renvoie null si aucun résultat", async () => {
    const c = new TmdbCatalog(cfg, fakeFetch(() => ({ results: [] })));
    expect(await c.findMovieByTitleYear("Zzz", null)).toBeNull();
  });
});
