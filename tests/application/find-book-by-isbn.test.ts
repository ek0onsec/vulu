import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { findBookByIsbn } from "@/server/application/find-book-by-isbn";

let deps: Deps;
beforeEach(() => { deps = makeInMemoryDeps(new FakeCatalog()); });

describe("findBookByIsbn", () => {
  it("ISBN valide (avec tirets) → summary, tirets normalisés", async () => {
    const r = await findBookByIsbn(deps, "978-0-441-56959-5");
    expect(r).toMatchObject({ source: "googlebooks", type: "book", externalId: "book-1" });
  });
  it("chaîne non-ISBN → null sans appeler le catalogue", async () => {
    const spy = vi.spyOn(deps.catalog, "findByIsbn");
    expect(await findBookByIsbn(deps, "abc")).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });
  it("ISBN inconnu → null", async () => {
    expect(await findBookByIsbn(deps, "9781234567897")).toBeNull();
  });
});
