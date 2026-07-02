import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { Crypto } from "@/server/ports/security";

// Étiquette de séparation de domaine : la clé AES est dérivée du secret racine AVEC ce contexte,
// pour qu'elle soit cryptographiquement distincte de toute autre utilisation du même secret
// (ex. signature JWT). Réutiliser le secret racine reste donc sûr.
const KEY_CONTEXT = "vulu:totp-secret-encryption:v1";

/** AES-256-GCM (clé dérivée du secret + contexte par sha256) + sha256 pour le hachage de jetons. */
export class NodeCrypto implements Crypto {
  private key: Buffer;
  constructor(secret: string) { this.key = createHash("sha256").update(KEY_CONTEXT).update(secret).digest(); }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(":");
  }

  decrypt(cipher: string): string {
    const [ivB, tagB, encB] = cipher.split(":");
    if (!ivB || !tagB || !encB) throw new Error("cipher invalide");
    const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(ivB, "base64"));
    decipher.setAuthTag(Buffer.from(tagB, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(encB, "base64")), decipher.final()]).toString("utf8");
  }

  hash(value: string): string { return createHash("sha256").update(value).digest("hex"); }
}
