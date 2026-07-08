import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { registerUser, registerWithInvite } from "@/server/application/register-user";
import { getMyInvite } from "@/server/application/invite";
import { NotFoundError } from "@/server/domain/errors";

let deps: Deps;
const base = { email: "a@x.io", username: "alice", displayName: "Alice", password: "password1",
  activeTabs: ["films"] as const, tastes: { filmGenreIds: [878, 18, 35], people: [] } };

beforeEach(() => { deps = makeInMemoryDeps(new FakeCatalog()); });

describe("getMyInvite", () => {
  it("retourne le code, le compteur et la liste des filleuls", async () => {
    const parrain = await registerUser(deps, { ...base });
    await registerWithInvite(deps, { ...base, email: "b@x.io", username: "bob", displayName: "Bob", inviteCode: parrain.inviteCode });
    await registerWithInvite(deps, { ...base, email: "c@x.io", username: "carol", displayName: "Carol", inviteCode: parrain.inviteCode });

    const info = await getMyInvite(deps, parrain.id);
    expect(info.code).toBe(parrain.inviteCode);
    expect(info.invitedCount).toBe(2);
    expect(info.invitees.map((i) => i.username).sort()).toEqual(["bob", "carol"]);
    expect(info.invitees[0]).toHaveProperty("displayName");
    expect(info.invitees[0]).toHaveProperty("avatarUrl");
  });

  it("génère et persiste un code pour un compte sans code (backfill lazy)", async () => {
    const u = await registerUser(deps, { ...base });
    // Simule un ancien compte sans code.
    await deps.users.update({ ...u, inviteCode: "" as unknown as string });
    const info = await getMyInvite(deps, u.id);
    expect(info.code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
    expect((await deps.users.findById(u.id))?.inviteCode).toBe(info.code);
  });

  it("rejette un utilisateur inconnu", async () => {
    await expect(getMyInvite(deps, "nope")).rejects.toThrow(NotFoundError);
  });
});
