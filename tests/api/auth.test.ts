import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startTestMongo, type TestMongo } from "../helpers/mongo";
import { ensureIndexes } from "@/server/adapters/mongo/indexes";
import { MongoUserRepository } from "@/server/adapters/mongo/repositories";
import { registerUser } from "@/server/application/register-user";
import { authenticateUser } from "@/server/application/authenticate-user";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";

let m: TestMongo; let deps: Deps;
beforeAll(async () => {
  m = await startTestMongo(); await ensureIndexes(m.db);
  deps = { ...makeInMemoryDeps(new FakeCatalog()), users: new MongoUserRepository(m.db) };
}, 120_000);
afterAll(async () => { await m.stop(); });

describe("auth (Mongo)", () => {
  it("register → login", async () => {
    await registerUser(deps, { email: "a@x.io", username: "alice", displayName: "Alice",
      password: "password1", activeTabs: ["films"], tastes: { filmGenreIds: [1, 2, 3], people: [] } });
    const { token } = await authenticateUser(deps, { email: "a@x.io", password: "password1" });
    expect(token).toBeTruthy();
  });
});
