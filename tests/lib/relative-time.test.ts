import { describe, it, expect } from "vitest";
import { relativeTime } from "@/lib/relative-time";

const now = new Date("2026-06-17T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);

describe("relativeTime", () => {
  it("à l'instant sous 45s", () => expect(relativeTime(ago(10_000), now)).toBe("à l'instant"));
  it("minutes", () => expect(relativeTime(ago(5 * 60_000), now)).toBe("5 min"));
  it("heures", () => expect(relativeTime(ago(2 * 3600_000), now)).toBe("2 h"));
  it("jours", () => expect(relativeTime(ago(3 * 86400_000), now)).toBe("3 j"));
  it("date au-delà d'une semaine", () => expect(relativeTime(ago(10 * 86400_000), now)).toMatch(/\d/));
});
