import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { registerUser } from "@/server/application/register-user";
import { searchUsers } from "@/server/application/search-users";

let deps: Deps; let me: string;
const tastes = { filmGenreIds: [1, 2, 3], people: [] };
beforeEach(async () => {
  deps = makeInMemoryDeps(new FakeCatalog());
  me = (await registerUser(deps, { email: "me@x.io", username: "me", displayName: "Moi", password: "password1", activeTabs: ["films"], tastes })).id;
  await registerUser(deps, { email: "t@x.io", username: "tom92", displayName: "Thomas", password: "password1", activeTabs: ["films"], tastes });
});

describe("searchUsers", () => {
  it("trouve par pseudo et mappe un DTO public sans secret", async () => {
    const out = await searchUsers(deps, me, "tom");
    expect(out).toHaveLength(1);
    expect(out[0]!.username).toBe("tom92");
    expect(out[0]!.displayName).toBe("Thomas");
    expect(out[0]).not.toHaveProperty("passwordHash");
    expect(out[0]).not.toHaveProperty("email");
  });
  it("exclut le viewer lui-même", async () => {
    expect(await searchUsers(deps, me, "moi")).toHaveLength(0);
  });
  it("renvoie [] sur query vide", async () => {
    expect(await searchUsers(deps, me, "   ")).toEqual([]);
  });
});
