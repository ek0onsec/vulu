"use client";
import { useEffect, useRef, useState } from "react";
import { PALETTES, type PaletteId, applyPalette, getStoredPalette, restoreSavedPalette } from "@/lib/theme";
import { toast } from "@/lib/toast";

/**
 * Sélecteur de thèmes de couleur.
 * - vulu (marque) : débloqué pour tous.
 * - Thèmes vulu+ : prévisualisables par tous, mais sauvegardés uniquement pour les abonnés.
 *   Sans abonnement, l'aperçu est rétabli à la palette enregistrée en quittant le panneau.
 */
export function ThemePicker({ plus }: { plus: boolean }) {
  const [selected, setSelected] = useState<PaletteId>("vulu");
  const previewingRef = useRef(false);

  useEffect(() => {
    setSelected(getStoredPalette());
    return () => { if (previewingRef.current) restoreSavedPalette(); };
  }, []);

  function choose(id: PaletteId) {
    setSelected(id);
    const free = PALETTES.find((p) => p.id === id)?.free;
    const persist = plus || Boolean(free);
    applyPalette(id, persist);
    previewingRef.current = !persist;
    if (persist) toast(id === "vulu" ? "Thème de marque rétabli" : "Thème activé ✓", { key: "theme" });
    else toast("Aperçu — passe à vulu+ pour le garder", { variant: "error", key: "theme" });
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {PALETTES.map((p) => {
        const locked = !plus && !p.free;
        const active = selected === p.id;
        return (
          <button key={p.id} onClick={() => choose(p.id)} aria-pressed={active}
            className={`relative rounded-xl border p-2 text-center transition-colors ${active ? "border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]" : "border-[var(--color-border)] hover:border-[var(--color-primary)]"}`}>
            <span className="mx-auto mb-1.5 block h-9 w-full rounded-md" style={{ background: `linear-gradient(135deg, ${p.swatch.from}, ${p.swatch.to})` }} />
            <span className="flex items-center justify-center gap-1 text-xs font-medium">
              {p.name}
              {locked && <span aria-label="Réservé à vulu+" title="Réservé à vulu+">🔒</span>}
              {active && <span className="text-[var(--color-primary)]">✓</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
