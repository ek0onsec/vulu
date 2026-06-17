import { describe, it, expect } from "vitest";
import { TmdbCatalog } from "@/server/adapters/catalog/tmdb-catalog";

function fakeFetch(routes: Record<string, unknown>): typeof fetch {
  return (async (url: string | URL | Request) => {
    const u = url.toString();
    const key = Object.keys(routes).find((k) => u.includes(k));
    if (!key) throw new Error("route inattendue: " + u);
    return { ok: true, json: async () => routes[key] } as Response;
  }) as typeof fetch;
}

const cfg = { apiKey: "tok", baseUrl: "https://api.themoviedb.org/3", imageBase: "https://img" };

describe("TmdbCatalog", () => {
  it("searchWorks mappe movie & tv", async () => {
    const c = new TmdbCatalog(cfg, fakeFetch({
      "/search/multi": { results: [
        { media_type: "movie", id: 603, title: "The Matrix", release_date: "1999-03-30", poster_path: "/p.jpg" },
        { media_type: "tv", id: 1396, name: "Breaking Bad", first_air_date: "2008-01-20", poster_path: "/q.jpg" },
        { media_type: "person", id: 5 },
      ] },
    }));
    const res = await c.searchWorks("x");
    expect(res).toHaveLength(2);
    expect(res[0]).toMatchObject({ externalId: "603", type: "movie", title: "The Matrix", year: 1999 });
    expect(res[0]?.posterUrl).toBe("https://img/w500/p.jpg");
    expect(res[1]).toMatchObject({ type: "tv", title: "Breaking Bad", year: 2008 });
  });
  it("getWork récupère détails + crédits (réalisateur)", async () => {
    const c = new TmdbCatalog(cfg, fakeFetch({
      "/movie/603": { id: 603, title: "The Matrix", release_date: "1999-03-30", poster_path: "/p.jpg",
        backdrop_path: "/b.jpg", overview: "Neo", genres: [{ id: 878, name: "Science Fiction" }],
        credits: { cast: [{ id: 6384, name: "Keanu Reeves" }], crew: [{ id: 1, name: "Lana W.", job: "Director" }] } },
    }));
    const w = await c.getWork("603", "movie");
    expect(w?.genres).toContain("Science Fiction");
    expect(w?.people.find((p) => p.role === "director")?.name).toBe("Lana W.");
    expect(w?.people.find((p) => p.role === "actor")?.name).toBe("Keanu Reeves");
  });
  it("listGenres fusionne movie + tv", async () => {
    const c = new TmdbCatalog(cfg, fakeFetch({
      "/genre/movie/list": { genres: [{ id: 878, name: "SF" }] },
      "/genre/tv/list": { genres: [{ id: 10765, name: "Sci-Fi & Fantasy" }] },
    }));
    expect((await c.listGenres()).length).toBe(2);
  });
});
