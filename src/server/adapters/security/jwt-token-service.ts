import { SignJWT, jwtVerify } from "jose";
import type { TokenService } from "@/server/ports/security";

export class JwtTokenService implements TokenService {
  private key: Uint8Array;
  constructor(secret: string) { this.key = new TextEncoder().encode(secret); }
  async issue(payload: { userId: string }) {
    return new SignJWT({ userId: payload.userId })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(this.key);
  }
  async verify(token: string) {
    try {
      const { payload } = await jwtVerify(token, this.key);
      return typeof payload.userId === "string" ? { userId: payload.userId } : null;
    } catch { return null; }
  }
}
