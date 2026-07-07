import { describe, it, expect } from "vitest";
import { mergeToast, type ToastItem } from "@/lib/toast";

const mk = (id: number, over: Partial<ToastItem> = {}): ToastItem => ({
  id, message: `m${id}`, variant: "success", durationMs: 2600, ...over,
});

describe("mergeToast", () => {
  it("empile les toasts sans clé", () => {
    const out = mergeToast([mk(1)], mk(2));
    expect(out.map((t) => t.id)).toEqual([1, 2]);
  });
  it("remplace un toast de même clé au lieu d'empiler (anti-spam)", () => {
    const a = mergeToast([], mk(1, { key: "theme", message: "Thème A" }));
    const b = mergeToast(a, mk(2, { key: "theme", message: "Thème B" }));
    expect(b).toHaveLength(1);
    expect(b[0]?.message).toBe("Thème B");
    expect(b[0]?.id).toBe(2);
  });
  it("des clés différentes coexistent", () => {
    const out = mergeToast([mk(1, { key: "a" })], mk(2, { key: "b" }));
    expect(out.map((t) => t.id)).toEqual([1, 2]);
  });
});
