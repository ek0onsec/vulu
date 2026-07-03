import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { registerUser } from "@/server/application/register-user";
import { markTourSeen } from "@/server/application/tour";

let deps: Deps; let uid: string;
const tastes = { filmGenreIds: [878, 18, 35], people: [] };
beforeEach(async () => {
  deps = makeInMemoryDeps(new FakeCatalog());
  uid = (await registerUser(deps, { email: "u@x.io", username: "u", displayName: "U", password: "password1", activeTabs: ["films"], tastes })).id;
});

describe("markTourSeen", () => {
  it("pose tourCompletedAt et le persiste", async () => {
    const before = await deps.users.findById(uid);
    expect(before?.tourCompletedAt).toBeNull();
    const updated = await markTourSeen(deps, uid);
    expect(updated.tourCompletedAt).not.toBeNull();
    const reloaded = await deps.users.findById(uid);
    expect(reloaded?.tourCompletedAt).not.toBeNull();
  });
  it("est idempotent (réappel ne casse rien)", async () => {
    await markTourSeen(deps, uid);
    const again = await markTourSeen(deps, uid);
    expect(again.tourCompletedAt).not.toBeNull();
  });
});
