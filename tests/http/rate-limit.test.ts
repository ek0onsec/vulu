import { describe, it, expect, beforeEach } from "vitest";
import { RateLimiter } from "@/server/http/rate-limit";

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
