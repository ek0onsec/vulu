import { describe, it, expect } from "vitest";
import { GoogleBooksCatalog } from "@/server/adapters/catalog/google-books-catalog";

function fakeFetch(routes: Record<string, unknown>): typeof fetch {
  return (async (url: string | URL | Request) => {
    const u = url.toString();
    const key = Object.keys(routes).find((k) => u.includes(k));
    if (!key) throw new Error("route inattendue: " + u);
    return { ok: true, json: async () => routes[key] } as Response;
  }) as typeof fetch;
}

const cfg = { baseUrl: "https://www.googleapis.com/books/v1" };

describe("GoogleBooksCatalog", () => {
  it("searchWorks mappe les volumes", async () => {
    const c = new GoogleBooksCatalog(cfg, fakeFetch({
      "/volumes": { items: [
        { id: "abc", volumeInfo: { title: "Neuromancien", authors: ["William Gibson"], publishedDate: "1984-07-01", imageLinks: { thumbnail: "http://x/c.jpg" } } },
      ] },
    }));
    const res = await c.searchWorks("neuro");
    expect(res[0]).toMatchObject({ source: "googlebooks", type: "book", title: "Neuromancien", year: 1984 });
    expect(res[0]?.posterUrl).toBe("https://x/c.jpg"); // http → https
  });
  it("searchWorks normalise la miniature Google Books (https, sans edge=curl, zoom lisible)", async () => {
    const c = new GoogleBooksCatalog(cfg, fakeFetch({
      "/volumes": { items: [
        { id: "abc", volumeInfo: { title: "T", imageLinks: {
          thumbnail: "http://books.google.com/books/content?id=Z&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api",
        } } },
      ] },
    }));
    const res = await c.searchWorks("t");
    expect(res[0]?.posterUrl).toBe(
      "https://books.google.com/books/content?id=Z&printsec=frontcover&img=1&zoom=2&source=gbs_api",
    );
  });
  it("getWork renvoie les auteurs comme people 'author'", async () => {
    const c = new GoogleBooksCatalog(cfg, fakeFetch({
      "/volumes/abc": { id: "abc", volumeInfo: { title: "Dune", authors: ["Frank Herbert"], categories: ["Science-fiction"], description: "..." } },
    }));
    const w = await c.getWork("abc");
    expect(w?.type).toBe("book");
    expect(w?.people[0]).toMatchObject({ name: "Frank Herbert", role: "author" });
    expect(w?.genres).toContain("Science-fiction");
  });
  it("listGenres renvoie une liste littéraire curée", async () => {
    const c = new GoogleBooksCatalog(cfg, fakeFetch({}));
    const g = await c.listGenres();
    expect(g.length).toBeGreaterThan(5);
    expect(g.map((x) => x.name)).toContain("Science-fiction");
  });
  it("findByIsbn renvoie le premier volume", async () => {
    const c = new GoogleBooksCatalog(cfg, fakeFetch({
      "/volumes": { items: [{ id: "xyz", volumeInfo: { title: "Dune", publishedDate: "1965" } }] },
    }));
    const r = await c.findByIsbn("9780441569595");
    expect(r).toMatchObject({ source: "googlebooks", type: "book", title: "Dune", externalId: "xyz" });
  });
  it("findByIsbn renvoie null si aucun volume", async () => {
    const c = new GoogleBooksCatalog(cfg, fakeFetch({ "/volumes": {} }));
    expect(await c.findByIsbn("0000000000000")).toBeNull();
  });

  const fakeSecondary = (over: Partial<{ title: string; authors: string[]; coverUrl: string | null }> = {}) => ({
    lookupIsbn: async () => ({ title: "La Route", authors: ["Cormac McCarthy"], coverUrl: "https://ol/cover.jpg", ...over }),
    coverByIsbn: async () => over.coverUrl ?? "https://ol/cover.jpg",
  });

  it("getWork : couverture de repli Open Library quand Google n'en a pas", async () => {
    const c = new GoogleBooksCatalog(cfg, fakeFetch({
      "/volumes/BK1": { id: "BK1", volumeInfo: { title: "La Route", industryIdentifiers: [{ type: "ISBN_13", identifier: "9782207116210" }] } },
    }), fakeSecondary());
    const w = await c.getWork("BK1");
    expect(w?.posterUrl).toBe("https://ol/cover.jpg");
  });

  it("findByIsbn : repli Open Library → recherche titre Google", async () => {
    // NB : URLSearchParams encode ':' en %3A ; l'appel ISBN se distingue par maxResults=1, l'appel titre par q=La+Route.
    const c = new GoogleBooksCatalog(cfg, fakeFetch({
      "maxResults=1": { items: [] }, // Google ne trouve pas par ISBN
      "q=La+Route": { items: [{ id: "BK1", volumeInfo: { title: "La Route" } }] }, // mais trouve par titre
    }), fakeSecondary());
    const r = await c.findByIsbn("9782207116210");
    expect(r?.externalId).toBe("BK1");
    expect(r?.posterUrl).toBe("https://ol/cover.jpg"); // couverture complétée depuis Open Library
  });

  it("sans secondary : comportement inchangé (couverture nulle, ISBN nul)", async () => {
    const c = new GoogleBooksCatalog(cfg, fakeFetch({ "maxResults=1": { items: [] } }));
    expect(await c.findByIsbn("0")).toBeNull();
  });

  const coversCfg = { ...cfg, coversBaseUrl: "https://covers.openlibrary.org" };

  it("searchWorks : couverture de repli Open Library par ISBN quand Google n'a pas d'image", async () => {
    const c = new GoogleBooksCatalog(coversCfg, fakeFetch({
      "/volumes": { items: [
        { id: "BK1", volumeInfo: { title: "La Route", industryIdentifiers: [{ type: "ISBN_13", identifier: "9782207116210" }] } },
      ] },
    }));
    const res = await c.searchWorks("route");
    expect(res[0]?.posterUrl).toBe("https://covers.openlibrary.org/b/isbn/9782207116210-M.jpg?default=false");
  });

  it("searchWorks : garde la couverture Google quand elle existe (pas de repli OL)", async () => {
    const c = new GoogleBooksCatalog(coversCfg, fakeFetch({
      "/volumes": { items: [
        { id: "BK1", volumeInfo: { title: "T", imageLinks: { thumbnail: "http://x/c.jpg" }, industryIdentifiers: [{ type: "ISBN_13", identifier: "9782207116210" }] } },
      ] },
    }));
    const res = await c.searchWorks("t");
    expect(res[0]?.posterUrl).toBe("https://x/c.jpg");
  });

  it("searchWorks : pas de couverture ni d'ISBN → posterUrl null", async () => {
    const c = new GoogleBooksCatalog(coversCfg, fakeFetch({
      "/volumes": { items: [{ id: "BK1", volumeInfo: { title: "Sans image" } }] },
    }));
    const res = await c.searchWorks("x");
    expect(res[0]?.posterUrl).toBeNull();
  });

  it("searchWorks : sans coversBaseUrl configuré, pas de repli OL (couverture nulle)", async () => {
    const c = new GoogleBooksCatalog(cfg, fakeFetch({
      "/volumes": { items: [
        { id: "BK1", volumeInfo: { title: "La Route", industryIdentifiers: [{ type: "ISBN_13", identifier: "9782207116210" }] } },
      ] },
    }));
    const res = await c.searchWorks("route");
    expect(res[0]?.posterUrl).toBeNull();
  });
});
