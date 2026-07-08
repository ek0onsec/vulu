export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(plain: string, hash: string): Promise<boolean>;
}
export interface TokenService {
  issue(payload: { userId: string }): Promise<string>;
  verify(token: string): Promise<{ userId: string } | null>;
  issueChallenge(userId: string): Promise<string>;
  verifyChallenge(token: string): Promise<{ userId: string } | null>;
}
export interface Totp {
  generateSecret(): string;
  keyUri(secret: string, account: string, issuer: string): string;
  verify(code: string, secret: string): boolean;
}
export interface Crypto {
  encrypt(plain: string): string;
  decrypt(cipher: string): string;
  hash(value: string): string;
  /** Entier aléatoire cryptographiquement sûr dans [0, maxExclusive). */
  randomInt(maxExclusive: number): number;
}
export interface IdGenerator {
  next(): string;
}
export interface InviteCodeGenerator {
  /** Un code brut de 8 caractères. L'unicité est vérifiée par l'appelant. */
  next(): string;
}
export interface Clock {
  now(): Date;
}
