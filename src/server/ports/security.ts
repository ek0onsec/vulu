export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(plain: string, hash: string): Promise<boolean>;
}
export interface TokenService {
  issue(payload: { userId: string }): Promise<string>;
  verify(token: string): Promise<{ userId: string } | null>;
}
export interface IdGenerator {
  next(): string;
}
export interface Clock {
  now(): Date;
}
