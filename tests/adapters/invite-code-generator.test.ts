import { describe, it, expect } from "vitest";
import { RandomInviteCodeGenerator } from "@/server/adapters/security/random-invite-code-generator";

describe("RandomInviteCodeGenerator", () => {
  const gen = new RandomInviteCodeGenerator();

  it("génère un code de 8 caractères de l'alphabet non ambigu", () => {
    for (let i = 0; i < 200; i++) {
      const code = gen.next();
      expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
    }
  });

  it("génère des codes variés (pas de constante)", () => {
    const codes = new Set(Array.from({ length: 50 }, () => gen.next()));
    expect(codes.size).toBeGreaterThan(40);
  });
});
