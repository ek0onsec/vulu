import type { Clock } from "@/server/ports/security";
export class SystemClock implements Clock { now() { return new Date(); } }
