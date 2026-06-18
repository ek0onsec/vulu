"use client";
import { useEffect, useState } from "react";
import { subscribeToasts, type ToastItem } from "@/lib/toast";

export function ToastViewport() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    return subscribeToasts((t) => {
      setItems((prev) => [...prev, t]);
      setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== t.id)), t.durationMs);
    });
  }, []);

  function dismiss(id: number) { setItems((prev) => prev.filter((x) => x.id !== id)); }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6">
      {items.map((t) => (
        <div key={t.id} role="status"
          className={`pointer-events-auto flex items-center gap-3 rounded-full border px-4 py-2.5 text-sm font-medium shadow-lg motion-safe:animate-[slideup_.2s_ease] ${
            t.variant === "error"
              ? "border-red-300 bg-red-50 text-red-700"
              : t.variant === "info"
              ? "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]"
              : "border-[color-mix(in_srgb,var(--color-primary)_40%,transparent)] bg-[var(--color-surface)] text-[var(--color-primary)]"
          }`}>
          <span className="flex items-center gap-2">
            <span aria-hidden>{t.variant === "error" ? "⚠" : "✓"}</span>{t.message}
          </span>
          {t.action && (
            <button onClick={() => { t.action!.onClick(); dismiss(t.id); }}
              className="rounded-full bg-[var(--color-primary)] px-3 py-1 text-xs font-semibold text-white">
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
