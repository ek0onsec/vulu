"use client";
import type { Domain } from "@/server/domain/entities";

export function TabSwitcher({ active, value, onChange }: { active: Domain[]; value: Domain; onChange: (d: Domain) => void }) {
  const tabs: { id: Domain; label: string }[] = [
    { id: "films", label: "🎬 Films & Séries" },
    { id: "books", label: "📚 Livres" },
  ];
  return (
    <div className="mb-4 flex gap-2">
      {tabs.filter((t) => active.includes(t.id)).map((t) => (
        <button
          key={t.id} onClick={() => onChange(t.id)}
          className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
            value === t.id
              ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
              : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
