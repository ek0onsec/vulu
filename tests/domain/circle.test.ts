import { describe, it, expect } from "vitest";
import { computeCircle } from "@/server/domain/circle";

describe("computeCircle", () => {
  it("retourne l'union des suivis et des abonnés, sans soi-même", () => {
    const circle = computeCircle("me", ["a", "b"], ["b", "c"]);
    expect([...circle].sort()).toEqual(["a", "b", "c"]);
  });
  it("exclut l'utilisateur lui-même", () => {
    const circle = computeCircle("me", ["me", "a"], ["me"]);
    expect([...circle].sort()).toEqual(["a"]);
  });
  it("retourne un Set vide si aucun lien", () => {
    expect(computeCircle("me", [], []).size).toBe(0);
  });
});
