import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { registerUser, registerWithInvite } from "@/server/application/register-user";
import { ValidationError } from "@/server/domain/errors";

let deps: Deps;
const base = { email: "a@x.io", username: "alice", displayName: "Alice", password: "password1",
  activeTabs: ["films"] as const, tastes: { filmGenreIds: [878, 18, 35], people: [] } };

beforeEach(() => { deps = makeInMemoryDeps(new FakeCatalog()); }); // founderCodes = {"TESTCODE"}

describe("registerWithInvite", () => {
  it("accepte un code fondateur (invitedBy null)", async () => {
    const u = await registerWithInvite(deps, { ...base, inviteCode: "TESTCODE" });
    expect(u.invitedBy).toBeNull();
    expect(u.inviteCode).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
  });

  it("accepte le code d'un utilisateur existant et fixe invitedBy sur le parrain", async () => {
    const parrain = await registerUser(deps, { ...base });
    const filleul = await registerWithInvite(deps, {
      ...base, email: "b@x.io", username: "bob", inviteCode: parrain.inviteCode,
    });
    expect(filleul.invitedBy).toBe(parrain.id);
  });

  it("accepte un code en minuscules (insensible à la casse)", async () => {
    const parrain = await registerUser(deps, { ...base });
    const filleul = await registerWithInvite(deps, {
      ...base, email: "c@x.io", username: "carol", inviteCode: parrain.inviteCode.toLowerCase(),
    });
    expect(filleul.invitedBy).toBe(parrain.id);
  });

  it("rejette un code inconnu", async () => {
    await expect(
      registerWithInvite(deps, { ...base, email: "d@x.io", username: "dave", inviteCode: "ZZZZ9999" }),
    ).rejects.toThrow(ValidationError);
  });

  it("rejette un code vide", async () => {
    await expect(
      registerWithInvite(deps, { ...base, email: "e@x.io", username: "erin", inviteCode: "   " }),
    ).rejects.toThrow(ValidationError);
  });
});
