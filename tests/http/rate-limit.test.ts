import { describe, it, expect, beforeEach } from "vitest";
import { RateLimiter, clientIp } from "@/server/http/rate-limit";

const reqWith = (headers: Record<string, string>) => new Request("http://x/", { headers });

describe("clientIp", () => {
  it("avec 1 proxy de confiance, prend l'entrée XFF la plus à droite (ignore le spoof client)", () => {
    // Le client préfixe une fausse IP ; le proxy ajoute la vraie à droite.
    const req = reqWith({ "x-forwarded-for": "1.2.3.4, 9.9.9.9" });
    expect(clientIp(req, 1)).toBe("9.9.9.9");
  });
  it("un client qui change la fausse IP n'altère pas la clé (anti-contournement)", () => {
    const a = clientIp(reqWith({ "x-forwarded-for": "evil-1, 9.9.9.9" }), 1);
    const b = clientIp(reqWith({ "x-forwarded-for": "evil-2, 9.9.9.9" }), 1);
    expect(a).toBe(b);
  });
  it("sans proxy de confiance, n'accorde aucune confiance à XFF", () => {
    expect(clientIp(reqWith({ "x-forwarded-for": "1.2.3.4" }), 0)).toBe("unknown");
    expect(clientIp(reqWith({ "x-real-ip": "5.5.5.5" }), 0)).toBe("5.5.5.5");
  });
});

describe("RateLimiter", () => {
  let now = 0;
  const limiter = new RateLimiter({ limit: 3, windowMs: 1000, clock: () => now });
  beforeEach(() => { now = 0; limiter.reset(); });

  it("autorise jusqu'à la limite puis bloque", () => {
    expect(limiter.allow("ip")).toBe(true);
    expect(limiter.allow("ip")).toBe(true);
    expect(limiter.allow("ip")).toBe(true);
    expect(limiter.allow("ip")).toBe(false);
  });
  it("réautorise après la fenêtre", () => {
    limiter.allow("ip"); limiter.allow("ip"); limiter.allow("ip");
    now = 1001;
    expect(limiter.allow("ip")).toBe(true);
  });
});
