import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { registerUser } from "@/server/application/register-user";
import { checkSignupAvailability } from "@/server/application/signup-availability";

const tastes = { filmGenreIds: [1, 2, 3], people: [] };
let deps: Deps;
beforeEach(async () => {
  deps = makeInMemoryDeps(new FakeCatalog());
  await registerUser(deps, { email: "taken@x.io", username: "taken", displayName: "Pris", password: "password1", activeTabs: ["films"], tastes });
});

describe("checkSignupAvailability", () => {
  it("pseudo et email libres → tout disponible", async () => {
    expect(await checkSignupAvailability(deps, { username: "libre", email: "libre@x.io" }))
      .toEqual({ usernameAvailable: true, emailAvailable: true });
  });
  it("pseudo pris (insensible à la casse) → usernameAvailable false", async () => {
    const r = await checkSignupAvailability(deps, { username: "TAKEN", email: "libre@x.io" });
    expect(r.usernameAvailable).toBe(false);
    expect(r.emailAvailable).toBe(true);
  });
  it("email pris (insensible à la casse) → emailAvailable false", async () => {
    const r = await checkSignupAvailability(deps, { username: "libre", email: "Taken@X.io" });
    expect(r.emailAvailable).toBe(false);
    expect(r.usernameAvailable).toBe(true);
  });
});
