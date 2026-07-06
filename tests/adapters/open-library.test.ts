import { describe, it, expect } from "vitest";
import { OpenLibraryBooks } from "@/server/adapters/catalog/open-library";

function fakeFetch(ok: boolean, body: unknown): typeof fetch {
  return (async () => ({ ok, json: async () => body }) as Response) as typeof fetch;
}

const cfg = { baseUrl: "https://openlibrary.org" };

describe("OpenLibraryBooks", () => {
  it("lookupIsbn parse titre, auteurs et couverture", async () => {
    const ol = new OpenLibraryBooks(cfg, fakeFetch(true, {
      "ISBN:9782207116210": { title: "La Route", authors: [{ name: "Cormac McCarthy" }], cover: { large: "https://covers/l.jpg", medium: "https://covers/m.jpg" } },
    }));
    const b = await ol.lookupIsbn("9782207116210");
    expect(b).toEqual({ title: "La Route", authors: ["Cormac McCarthy"], coverUrl: "https://covers/l.jpg" });
    expect(await ol.coverByIsbn("9782207116210")).toBe("https://covers/l.jpg");
  });
  it("renvoie null si l'ISBN est absent de la réponse", async () => {
    const ol = new OpenLibraryBooks(cfg, fakeFetch(true, {}));
    expect(await ol.lookupIsbn("0000000000000")).toBeNull();
  });
  it("renvoie null sur erreur HTTP", async () => {
    const ol = new OpenLibraryBooks(cfg, fakeFetch(false, {}));
    expect(await ol.lookupIsbn("123")).toBeNull();
  });
  it("couverture nulle si absente", async () => {
    const ol = new OpenLibraryBooks(cfg, fakeFetch(true, { "ISBN:1": { title: "X", authors: [], cover: {} } }));
    expect((await ol.lookupIsbn("1"))?.coverUrl).toBeNull();
  });
});
