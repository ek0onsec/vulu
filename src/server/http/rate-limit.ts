export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(private cfg: { limit: number; windowMs: number; clock?: () => number }) {}
  private now() { return this.cfg.clock ? this.cfg.clock() : Date.now(); }
  allow(key: string): boolean {
    const now = this.now();
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.cfg.windowMs);
    if (recent.length >= this.cfg.limit) { this.hits.set(key, recent); return false; }
    recent.push(now); this.hits.set(key, recent); return true;
  }
  reset() { this.hits.clear(); }
}

export const authLimiter = new RateLimiter({ limit: 10, windowMs: 60_000 });

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
