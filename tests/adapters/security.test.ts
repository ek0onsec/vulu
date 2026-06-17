import { describe, it, expect } from "vitest";
import { BcryptHasher } from "@/server/adapters/security/bcrypt-hasher";
import { JwtTokenService } from "@/server/adapters/security/jwt-token-service";

describe("security adapters", () => {
  it("hash puis verify", async () => {
    const h = new BcryptHasher(4);
    const hash = await h.hash("secret");
    expect(hash).not.toBe("secret");
    expect(await h.verify("secret", hash)).toBe(true);
    expect(await h.verify("wrong", hash)).toBe(false);
  });
  it("issue puis verify un token", async () => {
    const t = new JwtTokenService("test-secret-test-secret-test-secret-32");
    const token = await t.issue({ userId: "u1" });
    expect((await t.verify(token))?.userId).toBe("u1");
    expect(await t.verify("garbage")).toBeNull();
  });
});
