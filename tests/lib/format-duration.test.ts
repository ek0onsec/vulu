import { describe, it, expect } from "vitest";
import { formatWatchDuration } from "@/lib/format-duration";

describe("formatWatchDuration", () => {
  it("0 minute", () => expect(formatWatchDuration(0)).toBe("0 h"));
  it("moins d'un jour → heures", () => expect(formatWatchDuration(150)).toBe("2 h 30"));
  it("heures pleines", () => expect(formatWatchDuration(120)).toBe("2 h"));
  it("plusieurs jours", () => expect(formatWatchDuration(60 * 24 * 3 + 60 * 4)).toBe("3 j 4 h"));
  it("mois + jours", () => expect(formatWatchDuration(60 * 24 * 35)).toBe("1 mois 5 j"));
});
