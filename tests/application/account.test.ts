import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { registerUser } from "@/server/application/register-user";
import { authenticateUser } from "@/server/application/authenticate-user";
import { changeUsername, changePassword, requestAccountDeletion, DELETION_GRACE_MS } from "@/server/application/account";
import { ConflictError, AuthError } from "@/server/domain/errors";

const tastes = { filmGenreIds: [1, 2, 3], people: [] };
let deps: Deps; let now: Date; let meId: string;

beforeEach(async () => {
  deps = makeInMemoryDeps(new FakeCatalog());
  now = new Date("2026-06-18T12:00:00Z");
  deps.clock = { now: () => now };
  meId = (await registerUser(deps, { email: "me@x.io", username: "me", displayName: "Me", password: "password1", activeTabs: ["films"], tastes })).id;
});

describe("compte & sécurité", () => {
  it("changeUsername refuse un username pris", async () => {
    await registerUser(deps, { email: "a@x.io", username: "alice", displayName: "A", password: "password1", activeTabs: ["films"], tastes });
    await expect(changeUsername(deps, meId, "alice")).rejects.toThrow(ConflictError);
    const u = await changeUsername(deps, meId, "newname");
    expect(u.username).toBe("newname");
  });
  it("changePassword exige le bon mot de passe actuel", async () => {
    await expect(changePassword(deps, meId, "wrong", "password2")).rejects.toThrow(AuthError);
    await changePassword(deps, meId, "password1", "password2");
    const { token } = await authenticateUser(deps, { email: "me@x.io", password: "password2" });
    expect(token).toBeTruthy();
  });
  it("suppression : désactive, réactivable < 48 h", async () => {
    await requestAccountDeletion(deps, meId);
    expect((await deps.users.findById(meId))?.deactivatedAt).not.toBeNull();
    now = new Date(now.getTime() + 24 * 3600 * 1000); // +24 h
    const res = await authenticateUser(deps, { email: "me@x.io", password: "password1" });
    expect(res.reactivated).toBe(true);
    expect((await deps.users.findById(meId))?.deactivatedAt).toBeNull();
  });
  it("suppression : purge définitive après 48 h", async () => {
    await requestAccountDeletion(deps, meId);
    now = new Date(now.getTime() + DELETION_GRACE_MS + 1000);
    await expect(authenticateUser(deps, { email: "me@x.io", password: "password1" })).rejects.toThrow(AuthError);
    expect(await deps.users.findById(meId)).toBeNull();
  });
});
