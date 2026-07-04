import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { registerUser } from "@/server/application/register-user";
import { getCurrentUser } from "@/server/application/get-current-user";

let deps: Deps; let uid: string;
const tastes = { filmGenreIds: [878, 18, 35], people: [] };
beforeEach(async () => {
  deps = makeInMemoryDeps(new FakeCatalog());
  uid = (await registerUser(deps, { email: "b@x.io", username: "bob", displayName: "Bob", password: "password1", activeTabs: ["films"], tastes })).id;
});

/** Extraction du token depuis un header Authorization (miroir de session.currentUser). */
function bearerToken(authz: string | null): string | undefined {
  return authz?.startsWith("Bearer ") ? authz.slice(7) : undefined;
}

describe("auth Bearer", () => {
  it("un token Bearer valide résout l'utilisateur courant", async () => {
    const token = await deps.tokens.issue({ userId: uid });
    const extracted = bearerToken(`Bearer ${token}`);
    const user = await getCurrentUser(deps, extracted);
    expect(user?.id).toBe(uid);
  });
  it("un header absent → pas de token → pas d'utilisateur", async () => {
    expect(bearerToken(null)).toBeUndefined();
    expect(await getCurrentUser(deps, undefined)).toBeNull();
  });
  it("un token invalide → pas d'utilisateur", async () => {
    expect(await getCurrentUser(deps, "pas-un-jwt")).toBeNull();
  });
});
