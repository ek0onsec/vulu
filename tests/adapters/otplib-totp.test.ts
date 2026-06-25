import { describe, it, expect } from "vitest";
import { authenticator } from "otplib";
import { OtplibTotp } from "@/server/adapters/security/otplib-totp";

const t = new OtplibTotp();

describe("OtplibTotp", () => {
  it("vérifie un code généré pour le secret", () => {
    const secret = t.generateSecret();
    expect(t.verify(authenticator.generate(secret), secret)).toBe(true);
    expect(t.verify("000000", secret)).toBe(false);
  });
  it("keyUri contient le schéma otpauth et l'issuer", () => {
    const uri = t.keyUri("JBSWY3DPEHPK3PXP", "alice", "vulu");
    expect(uri).toContain("otpauth://totp/");
    expect(uri).toContain("vulu");
  });
});
