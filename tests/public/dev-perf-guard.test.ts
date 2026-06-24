import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Charge le shim public/dev-perf-guard.js dans un contexte où `performance.measure`
// rejette les bornes négatives (comme le navigateur), pour prouver que le shim
// neutralise le throw « negative time stamp » tout en bornant les valeurs.
function loadGuard(measureImpl: (name: string, opts?: unknown) => unknown) {
  const perf = { measure: measureImpl } as unknown as Performance;
  const src = readFileSync(join(process.cwd(), "public/dev-perf-guard.js"), "utf8");
  // Expose `performance` au script via un paramètre de fonction.
  new Function("performance", src)(perf);
  return perf;
}

describe("dev-perf-guard", () => {
  it("neutralise le throw et borne les bornes négatives à 0", () => {
    const calls: Array<{ start: unknown; end: unknown }> = [];
    const perf = loadGuard((_name, opts) => {
      const o = opts as { start: number; end: number };
      if (typeof o?.start === "number" && o.start < 0) throw new TypeError("cannot have a negative time stamp");
      calls.push({ start: o.start, end: o.end });
    });
    expect(() => perf.measure("​ProfilePage", { start: -120, end: -10 } as PerformanceMeasureOptions)).not.toThrow();
    expect(calls).toEqual([{ start: 0, end: 0 }]);
  });

  it("laisse passer une mesure valide inchangée", () => {
    const calls: Array<{ start: unknown; end: unknown }> = [];
    const perf = loadGuard((_name, opts) => {
      const o = opts as { start: number; end: number };
      calls.push({ start: o.start, end: o.end });
    });
    perf.measure("ok", { start: 5, end: 12 } as PerformanceMeasureOptions);
    expect(calls).toEqual([{ start: 5, end: 12 }]);
  });
});
