import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { registerUser } from "@/server/application/register-user";
import { ConflictError, ValidationError } from "@/server/domain/errors";

let deps: Deps;
const base = { email: "a@x.io", username: "alice", displayName: "Alice", password: "password1",
  activeTabs: ["films"] as const, tastes: { filmGenreIds: [878, 18, 35], people: [] } };

beforeEach(() => { deps = makeInMemoryDeps(new FakeCatalog()); });

describe("registerUser", () => {
  it("crée un utilisateur avec mot de passe hashé", async () => {
    const u = await registerUser(deps, { ...base });
    expect(u.id).toBeTruthy();
    expect(u.passwordHash).not.toBe("password1");
    expect(await deps.users.findByEmail("a@x.io")).not.toBeNull();
  });
  it("rejette un email déjà pris (insensible casse)", async () => {
    await registerUser(deps, { ...base });
    await expect(registerUser(deps, { ...base, username: "bob", email: "A@X.IO" })).rejects.toThrow(ConflictError);
  });
  it("rejette un username déjà pris", async () => {
    await registerUser(deps, { ...base });
    await expect(registerUser(deps, { ...base, email: "b@x.io" })).rejects.toThrow(ConflictError);
  });
  it("rejette moins de 3 genres", async () => {
    await expect(registerUser(deps, { ...base, tastes: { filmGenreIds: [878], people: [] } })).rejects.toThrow(ValidationError);
  });
  it("rejette un mot de passe trop court", async () => {
    await expect(registerUser(deps, { ...base, password: "short" })).rejects.toThrow(ValidationError);
  });
  it("rejette activeTabs vide", async () => {
    await expect(registerUser(deps, { ...base, activeTabs: [] })).rejects.toThrow(ValidationError);
  });
});
