import { describe, it, expect } from "vitest";
import { CompositeCatalog } from "@/server/adapters/catalog/composite-catalog";
import { TmdbCatalog } from "@/server/adapters/catalog/tmdb-catalog";
import { GoogleBooksCatalog } from "@/server/adapters/catalog/google-books-catalog";

function fakeFetch(routes: Record<string, unknown>): typeof fetch {
  return (async (url: string | URL | Request) => {
    const u = url.toString();
    const key = Object.keys(routes).find((k) => u.includes(k));
    if (!key) throw new Error("route inattendue: " + u);
    return { ok: true, json: async () => routes[key] } as Response;
  }) as typeof fetch;
}

const tmdb = new TmdbCatalog(
  { apiKey: "t", baseUrl: "https://api.themoviedb.org/3", imageBase: "https://img" },
  fakeFetch({ "/search/multi": { results: [{ media_type: "movie", id: 1, title: "Film", release_date: "2020" }] } }),
);
const books = new GoogleBooksCatalog(
  { baseUrl: "https://books" },
  fakeFetch({ "/volumes": { items: [{ id: "b1", volumeInfo: { title: "Livre", authors: ["A"] } }] } }),
);
const composite = new CompositeCatalog(tmdb, books);

describe("CompositeCatalog", () => {
  it("route films → TMDB", async () => {
    const res = await composite.searchWorks("x", "films");
    expect(res[0]?.source).toBe("tmdb");
  });
  it("route livres → Google Books", async () => {
    const res = await composite.searchWorks("x", "books");
    expect(res[0]?.source).toBe("googlebooks");
  });
});
