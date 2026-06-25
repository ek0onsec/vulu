import { authenticator } from "otplib";
import type { Totp } from "@/server/ports/security";

export class OtplibTotp implements Totp {
  generateSecret(): string { return authenticator.generateSecret(); }
  keyUri(secret: string, account: string, issuer: string): string {
    return authenticator.keyuri(account, issuer, secret);
  }
  verify(code: string, secret: string): boolean {
    try { return authenticator.verify({ token: code, secret }); } catch { return false; }
  }
}
