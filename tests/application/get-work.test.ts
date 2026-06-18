import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { getOrImportWork } from "@/server/application/get-work";
import { NotFoundError } from "@/server/domain/errors";

let deps: Deps;
beforeEach(() => { deps = makeInMemoryDeps(new FakeCatalog()); });

describe("getOrImportWork", () => {
  it("importe puis met en cache", async () => {
    const w = await getOrImportWork(deps, { source: "tmdb", externalId: "603", type: "movie" });
    expect(w.title).toBe("The Matrix");
    expect(w.domain).toBe("films");
    expect(await deps.works.findByExternal("tmdb", "603")).not.toBeNull();
  });
  it("renvoie le cache au 2e appel (même id)", async () => {
    const a = await getOrImportWork(deps, { source: "tmdb", externalId: "603", type: "movie" });
    const b = await getOrImportWork(deps, { source: "tmdb", externalId: "603", type: "movie" });
    expect(b.id).toBe(a.id);
  });
  it("NotFound si absent du catalogue", async () => {
    await expect(getOrImportWork(deps, { source: "tmdb", externalId: "999", type: "movie" })).rejects.toThrow(NotFoundError);
  });
  it("importe un livre avec le domaine 'books'", async () => {
    const w = await getOrImportWork(deps, { source: "googlebooks", externalId: "book-1", type: "book" });
    expect(w.domain).toBe("books");
    expect(w.people[0]?.role).toBe("author");
  });
});
