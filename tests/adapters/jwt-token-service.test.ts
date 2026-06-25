import { describe, it, expect } from "vitest";
import { JwtTokenService } from "@/server/adapters/security/jwt-token-service";

const svc = new JwtTokenService("test-secret-test-secret-test-secret-32");

describe("JwtTokenService — challenge vs session", () => {
  it("verifyChallenge accepte un challenge, le rejette comme session", async () => {
    const ch = await svc.issueChallenge("u1");
    expect(await svc.verifyChallenge(ch)).toEqual({ userId: "u1" });
    expect(await svc.verify(ch)).toBeNull(); // un challenge ne vaut pas session
  });
  it("verify accepte une session, verifyChallenge la rejette", async () => {
    const tok = await svc.issue({ userId: "u1" });
    expect(await svc.verify(tok)).toEqual({ userId: "u1" });
    expect(await svc.verifyChallenge(tok)).toBeNull();
  });
});
