import { describe, it, expect, beforeEach } from "vitest";
import { makeInMemoryDeps, type Deps } from "@/server/container";
import { FakeCatalog } from "../helpers/fake-catalog";
import { registerUser } from "@/server/application/register-user";
import { detectImage, updateAvatar } from "@/server/application/profile-media";
import { ValidationError } from "@/server/domain/errors";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);

let deps: Deps; let userId: string;
beforeEach(async () => {
  deps = makeInMemoryDeps(new FakeCatalog());
  userId = (await registerUser(deps, { email: "a@x.io", username: "alice", displayName: "Alice",
    password: "password1", activeTabs: ["films"], tastes: { filmGenreIds: [1, 2, 3], people: [] } })).id;
});

describe("detectImage", () => {
  it("reconnaît PNG et JPEG, rejette le reste", () => {
    expect(detectImage(PNG)).toBe("png");
    expect(detectImage(JPG)).toBe("jpg");
    expect(detectImage(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});

describe("updateAvatar", () => {
  it("stocke et met à jour avatarUrl", async () => {
    const u = await updateAvatar(deps, userId, PNG);
    expect(u.avatarUrl).toMatch(/^\/uploads\//);
  });
  it("rejette un format non image", async () => {
    await expect(updateAvatar(deps, userId, new Uint8Array([0, 1, 2, 3]))).rejects.toThrow(ValidationError);
  });
  it("rejette une image trop lourde", async () => {
    const big = new Uint8Array(600 * 1024); big.set(PNG, 0);
    await expect(updateAvatar(deps, userId, big)).rejects.toThrow(ValidationError);
  });
});
