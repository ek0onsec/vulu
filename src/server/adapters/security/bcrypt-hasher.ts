import bcrypt from "bcryptjs";
import type { PasswordHasher } from "@/server/ports/security";

export class BcryptHasher implements PasswordHasher {
  constructor(private readonly rounds = 12) {}
  hash(plain: string) { return bcrypt.hash(plain, this.rounds); }
  verify(plain: string, hash: string) { return bcrypt.compare(plain, hash); }
}
