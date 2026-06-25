import { describe, it, expect } from "vitest";
import { NodeCrypto } from "@/server/adapters/security/node-crypto";

const c = new NodeCrypto("a-very-long-test-secret-of-32+chars!!");

describe("NodeCrypto", () => {
  it("chiffre puis déchiffre (round-trip)", () => {
    const enc = c.encrypt("JBSWY3DPEHPK3PXP");
    expect(enc).not.toContain("JBSWY3DPEHPK3PXP");
    expect(c.decrypt(enc)).toBe("JBSWY3DPEHPK3PXP");
  });
  it("rejette un message altéré", () => {
    const enc = c.encrypt("secret");
    expect(() => c.decrypt(enc.slice(0, -2) + "00")).toThrow();
  });
  it("hash déterministe (sha256)", () => {
    expect(c.hash("ABCD-1234")).toBe(c.hash("ABCD-1234"));
    expect(c.hash("ABCD-1234")).not.toBe(c.hash("ABCD-1235"));
  });
});
