import { describe, it, expect } from "vitest";
import { makeInMemoryDeps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { searchCatalog, listGenres, searchPeople } from "@/server/application/catalog";

describe("catalog use-cases", () => {
  it("searchCatalog délègue au provider", async () => {
    const deps = makeInMemoryDeps(new FakeCatalog());
    const res = await searchCatalog(deps, "matrix");
    expect(res[0]?.title).toBe("The Matrix");
  });
  it("listGenres + searchPeople délèguent", async () => {
    const deps = makeInMemoryDeps(new FakeCatalog());
    expect((await listGenres(deps)).length).toBeGreaterThan(0);
    expect((await searchPeople(deps, "den"))[0]?.name).toContain("Villeneuve");
  });
});
