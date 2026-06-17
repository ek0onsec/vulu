import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { followUser, unfollowUser, getCircle } from "@/server/application/social";
import { ValidationError } from "@/server/domain/errors";

let deps: Deps;
beforeEach(() => { deps = makeInMemoryDeps(new FakeCatalog()); });

describe("social", () => {
  it("follow puis cercle inclut l'autre", async () => {
    await followUser(deps, "me", "alice");
    expect([...(await getCircle(deps, "me"))]).toContain("alice");
  });
  it("le cercle est l'union des deux sens", async () => {
    await followUser(deps, "me", "alice");
    await followUser(deps, "bob", "me");
    const c = await getCircle(deps, "me");
    expect([...c].sort()).toEqual(["alice", "bob"]);
  });
  it("rejette le self-follow", async () => {
    await expect(followUser(deps, "me", "me")).rejects.toThrow(ValidationError);
  });
  it("follow idempotent", async () => {
    await followUser(deps, "me", "alice");
    await followUser(deps, "me", "alice");
    expect(await deps.follows.countFollowing("me")).toBe(1);
  });
  it("unfollow retire du cercle", async () => {
    await followUser(deps, "me", "alice");
    await unfollowUser(deps, "me", "alice");
    expect([...(await getCircle(deps, "me"))]).not.toContain("alice");
  });
});
