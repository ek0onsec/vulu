import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { createList, addWorkToList, removeWorkFromList, updateList, deleteList, listsOf } from "@/server/application/lists";
import { ForbiddenError } from "@/server/domain/errors";

let deps: Deps; const ref = { source: "tmdb" as const, externalId: "603", type: "movie" as const };
beforeEach(() => { deps = makeInMemoryDeps(new FakeCatalog()); });

describe("lists", () => {
  it("crée une liste", async () => {
    const l = await createList(deps, "u1", { name: "SF culte", domain: "films", description: null, visibility: "public" });
    expect((await listsOf(deps, "u1")).map((x) => x.id)).toContain(l.id);
  });
  it("ajoute une œuvre sans doublon", async () => {
    const l = await createList(deps, "u1", { name: "SF", domain: "films", description: null, visibility: "public" });
    const after = await addWorkToList(deps, "u1", l.id, ref);
    await addWorkToList(deps, "u1", l.id, ref);
    const fresh = await deps.lists.findById(l.id);
    expect(fresh?.workIds).toHaveLength(1);
    expect(after.workIds).toHaveLength(1);
  });
  it("retire une œuvre", async () => {
    const l = await createList(deps, "u1", { name: "SF", domain: "films", description: null, visibility: "public" });
    await addWorkToList(deps, "u1", l.id, ref);
    const work = await deps.works.findByExternal("tmdb", "603");
    await removeWorkFromList(deps, "u1", l.id, work!.id);
    expect((await deps.lists.findById(l.id))?.workIds).toHaveLength(0);
  });
  it("interdit la modif par un non-propriétaire", async () => {
    const l = await createList(deps, "u1", { name: "SF", domain: "films", description: null, visibility: "public" });
    await expect(updateList(deps, "u2", l.id, { name: "x", description: null, visibility: "private" })).rejects.toThrow(ForbiddenError);
    await expect(deleteList(deps, "u2", l.id)).rejects.toThrow(ForbiddenError);
  });
});
