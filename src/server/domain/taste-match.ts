/** Résultat de similarité sur des notes croisées (couche domaine, pure). */
export interface TasteMatch {
  /** Score de compatibilité 0–100 (entier). */
  score: number;
  /** Nombre d'œuvres co-notées ayant servi au calcul. */
  overlap: number;
}

/**
 * Match % sur les œuvres co-notées : 100 × (1 − moyenne(|a−b|) / 5), arrondi entier.
 * Pur, sans dépendance externe. Le seuil d'affichage (overlap ≥ 3) est la
 * responsabilité de l'appelant, pas de cette fonction.
 */
export function tasteMatchScore(pairs: { a: number; b: number }[]): TasteMatch {
  const overlap = pairs.length;
  if (overlap === 0) return { score: 0, overlap: 0 };
  const totalDiff = pairs.reduce((sum, p) => sum + Math.abs(p.a - p.b), 0);
  const score = Math.round(100 * (1 - totalDiff / overlap / 5));
  return { score, overlap };
}
