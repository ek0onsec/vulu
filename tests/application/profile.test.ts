import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { registerUser } from "@/server/application/register-user";
import { getCurrentUser } from "@/server/application/get-current-user";
import { updateProfile } from "@/server/application/update-profile";
import { updateTastes } from "@/server/application/update-tastes";
import { ValidationError } from "@/server/domain/errors";

let deps: Deps; let userId: string;
beforeEach(async () => {
  deps = makeInMemoryDeps(new FakeCatalog());
  const u = await registerUser(deps, { email: "a@x.io", username: "alice", displayName: "Alice",
    password: "password1", activeTabs: ["films"], tastes: { filmGenreIds: [878, 18, 35], people: [] } });
  userId = u.id;
});

describe("profil", () => {
  it("getCurrentUser via token", async () => {
    const token = await deps.tokens.issue({ userId });
    expect((await getCurrentUser(deps, token))?.id).toBe(userId);
    expect(await getCurrentUser(deps, "bad")).toBeNull();
  });
  it("updateProfile change bio + displayName", async () => {
    const u = await updateProfile(deps, userId, { displayName: "Alice B", bio: "hello", avatarUrl: null, activeTabs: ["films"] });
    expect(u.displayName).toBe("Alice B");
    expect(u.bio).toBe("hello");
  });
  it("updateProfile rejette activeTabs vide", async () => {
    await expect(updateProfile(deps, userId, { displayName: "A", bio: null, avatarUrl: null, activeTabs: [] })).rejects.toThrow(ValidationError);
  });
  it("updateTastes remplace les goûts", async () => {
    const u = await updateTastes(deps, userId, { filmGenreIds: [878, 18, 35, 53], people: [{ tmdbId: 1, name: "Villeneuve", role: "director" }] });
    expect(u.tastes.filmGenreIds).toContain(53);
    expect(u.tastes.people).toHaveLength(1);
  });
});
