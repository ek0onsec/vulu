import { describe, it, expect } from "vitest";
import { resolveTargetName, type TourStep } from "@/lib/tour-target";

const step: TourStep = { id: "s", route: "/feed", target: "feed-card", fallbackTarget: "nav-feed", title: "t", body: "b", placement: "bottom" };

describe("resolveTargetName", () => {
  it("cible présente → cible", () => {
    expect(resolveTargetName(step, (n) => n === "feed-card")).toBe("feed-card");
  });
  it("cible absente, repli présent → repli", () => {
    expect(resolveTargetName(step, (n) => n === "nav-feed")).toBe("nav-feed");
  });
  it("les deux absents → null", () => {
    expect(resolveTargetName(step, () => false)).toBeNull();
  });
  it("placement center → null", () => {
    expect(resolveTargetName({ ...step, placement: "center" }, () => true)).toBeNull();
  });
});
