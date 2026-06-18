import { describe, it, expect } from "vitest";
import { makeInMemoryDeps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { searchCatalog, listGenres, searchPeople } from "@/server/application/catalog";

describe("catalog use-cases", () => {
  it("searchCatalog délègue au provider (films)", async () => {
    const deps = makeInMemoryDeps(new FakeCatalog());
    const res = await searchCatalog(deps, "matrix", "films");
    expect(res[0]?.title).toBe("The Matrix");
  });
  it("searchCatalog livres renvoie un livre", async () => {
    const deps = makeInMemoryDeps(new FakeCatalog());
    const res = await searchCatalog(deps, "neuro", "books");
    expect(res[0]?.type).toBe("book");
  });
  it("listGenres + searchPeople délèguent", async () => {
    const deps = makeInMemoryDeps(new FakeCatalog());
    expect((await listGenres(deps, "films")).length).toBeGreaterThan(0);
    expect((await searchPeople(deps, "den", "films"))[0]?.name).toContain("Villeneuve");
    expect((await searchPeople(deps, "gib", "books"))[0]?.role).toBe("author");
  });
});
