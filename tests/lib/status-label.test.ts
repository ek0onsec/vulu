import { describe, it, expect } from "vitest";
import { statusLabel } from "@/lib/status-label";

describe("statusLabel", () => {
  it("films/séries : à voir / en cours / vu", () => {
    expect(statusLabel("planned", "movie")).toBe("À voir");
    expect(statusLabel("planned", "tv")).toBe("À voir");
    expect(statusLabel("in_progress", "movie")).toBe("En cours");
    expect(statusLabel("done", "movie")).toBe("Vu");
  });
  it("livres : à lire / en cours / lu", () => {
    expect(statusLabel("planned", "book")).toBe("À lire");
    expect(statusLabel("in_progress", "book")).toBe("En cours");
    expect(statusLabel("done", "book")).toBe("Lu");
  });
});
