import { randomUUID } from "node:crypto";
import type { IdGenerator } from "@/server/ports/security";
export class UuidIdGenerator implements IdGenerator { next() { return randomUUID(); } }
