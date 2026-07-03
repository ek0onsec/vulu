import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { registerUser } from "@/server/application/register-user";
import { followUser } from "@/server/application/social";
import { listFollowers, listFollowing } from "@/server/application/follow-lists";

let deps: Deps; let a: string; let b: string;
const tastes = { filmGenreIds: [878, 18, 35], people: [] };
beforeEach(async () => {
  deps = makeInMemoryDeps(new FakeCatalog());
  a = (await registerUser(deps, { email: "a@x.io", username: "alice", displayName: "Alice", password: "password1", activeTabs: ["films"], tastes })).id;
  b = (await registerUser(deps, { email: "b@x.io", username: "bob", displayName: "Bob", password: "password1", activeTabs: ["films"], tastes })).id;
  await followUser(deps, a, b); // alice suit bob
});

describe("follow lists", () => {
  it("listFollowers(bob) contient alice", async () => {
    const followers = await listFollowers(deps, b);
    expect(followers.map((u) => u.username)).toContain("alice");
  });
  it("listFollowing(alice) contient bob", async () => {
    const following = await listFollowing(deps, a);
    expect(following.map((u) => u.username)).toContain("bob");
  });
  it("le DTO ne fuit pas de champ sensible (pas de passwordHash)", async () => {
    const [u] = await listFollowers(deps, b);
    expect(Object.keys(u!)).toEqual(expect.arrayContaining(["id", "username", "displayName", "avatarUrl", "plus", "staff"]));
    expect(u as unknown as Record<string, unknown>).not.toHaveProperty("passwordHash");
  });
});
