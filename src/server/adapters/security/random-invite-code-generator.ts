import { randomInt } from "node:crypto";
import type { InviteCodeGenerator } from "@/server/ports/security";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const LENGTH = 8;

export class RandomInviteCodeGenerator implements InviteCodeGenerator {
  next(): string {
    let code = "";
    for (let i = 0; i < LENGTH; i++) code += ALPHABET[randomInt(ALPHABET.length)];
    return code;
  }
}
