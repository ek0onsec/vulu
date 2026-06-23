import { getEnv } from "@/lib/env";

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

/**
 * IP cliente fiable pour le rate-limiting. Avec `trustedHops` proxys de confiance en
 * amont, l'IP réelle est la `trustedHops`-ième entrée de X-Forwarded-For en partant de
 * la fin : les entrées de gauche sont fournies par le client et donc falsifiables.
 * Sans proxy de confiance (`trustedHops = 0`), on n'accorde aucune confiance à
 * X-Forwarded-For ; on retombe sur `x-real-ip` puis sur un seau commun « unknown ».
 */
export function clientIp(req: Request, trustedHops = getEnv().TRUSTED_PROXY_HOPS): string {
  const xff = req.headers.get("x-forwarded-for");
  const parts = xff ? xff.split(",").map((s) => s.trim()).filter(Boolean) : [];
  if (trustedHops > 0 && parts.length >= trustedHops) {
    return parts[parts.length - trustedHops]!;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}
