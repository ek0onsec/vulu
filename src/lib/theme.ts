export type Theme = "light" | "dark";
const KEY = "vulu-theme";

export function getStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(KEY);
  return v === "light" || v === "dark" ? v : null;
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  window.localStorage.setItem(KEY, theme);
}

export function initialTheme(): Theme {
  const stored = getStoredTheme();
  if (stored) return stored;
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

/* ---- Palettes de couleur (thèmes vulu+) ---- */

export type PaletteId = "vulu" | "aurore" | "foret" | "retro" | "ocean" | "crepuscule";
const PALETTE_KEY = "vulu-palette";

export interface Palette {
  id: PaletteId;
  name: string;
  /** Couleurs d'aperçu (swatch) — purement présentationnelles. */
  swatch: { from: string; to: string };
  /** Le thème de marque par défaut, débloqué pour tous. */
  free?: boolean;
}

/** Source de vérité des thèmes. Les valeurs appliquées vivent dans globals.css ([data-palette]). */
export const PALETTES: Palette[] = [
  { id: "vulu", name: "vulu", swatch: { from: "#9461C0", to: "#F8C84E" }, free: true },
  { id: "aurore", name: "Aurore", swatch: { from: "#7C3AED", to: "#22D3EE" } },
  { id: "foret", name: "Forêt", swatch: { from: "#15803D", to: "#F59E0B" } },
  { id: "retro", name: "Rétro", swatch: { from: "#DB2777", to: "#FACC15" } },
  { id: "ocean", name: "Océan", swatch: { from: "#0E7490", to: "#F472B6" } },
  { id: "crepuscule", name: "Crépuscule", swatch: { from: "#C2410C", to: "#7C3AED" } },
];

function isPaletteId(v: string | null): v is PaletteId {
  return PALETTES.some((p) => p.id === v);
}

export function getStoredPalette(): PaletteId {
  if (typeof window === "undefined") return "vulu";
  const v = window.localStorage.getItem(PALETTE_KEY);
  return isPaletteId(v) ? v : "vulu";
}

/**
 * Applique une palette en direct. `persist` n'est vrai que pour les abonnés vulu+ :
 * les non-abonnés peuvent prévisualiser, mais le choix n'est pas sauvegardé (revient au rechargement).
 */
export function applyPalette(id: PaletteId, persist: boolean): void {
  if (id === "vulu") document.documentElement.removeAttribute("data-palette");
  else document.documentElement.setAttribute("data-palette", id);
  if (persist) window.localStorage.setItem(PALETTE_KEY, id);
}

/** Réinitialise l'aperçu vers la palette réellement sauvegardée (sortie de page sans abonnement). */
export function restoreSavedPalette(): void {
  applyPalette(getStoredPalette(), false);
}
