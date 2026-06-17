import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { registerUser } from "@/server/application/register-user";
import { authenticateUser } from "@/server/application/authenticate-user";
import { AuthError } from "@/server/domain/errors";

let deps: Deps;
beforeEach(async () => {
  deps = makeInMemoryDeps(new FakeCatalog());
  await registerUser(deps, { email: "a@x.io", username: "alice", displayName: "Alice",
    password: "password1", activeTabs: ["films"], tastes: { filmGenreIds: [878, 18, 35], people: [] } });
});

describe("authenticateUser", () => {
  it("retourne un token + user pour de bons identifiants", async () => {
    const res = await authenticateUser(deps, { email: "A@x.io", password: "password1" });
    expect(res.token).toBeTruthy();
    expect((await deps.tokens.verify(res.token))?.userId).toBe(res.user.id);
  });
  it("rejette un mauvais mot de passe", async () => {
    await expect(authenticateUser(deps, { email: "a@x.io", password: "nope" })).rejects.toThrow(AuthError);
  });
  it("rejette un email inconnu", async () => {
    await expect(authenticateUser(deps, { email: "none@x.io", password: "password1" })).rejects.toThrow(AuthError);
  });
});
