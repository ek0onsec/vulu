export type TourPlacement = "top" | "bottom" | "left" | "right" | "center";

export interface TourStep {
  id: string;
  route: string;
  target: string;          // valeur data-tour de la cible principale
  fallbackTarget?: string; // valeur data-tour de repli (ex. item de nav)
  title: string;
  body: string;
  placement: TourPlacement;
}

/** Nom de data-tour à spotlighter : cible → repli → null (tooltip centrée). Pur. */
export function resolveTargetName(step: TourStep, isPresent: (name: string) => boolean): string | null {
  if (step.placement === "center") return null;
  if (isPresent(step.target)) return step.target;
  if (step.fallbackTarget && isPresent(step.fallbackTarget)) return step.fallbackTarget;
  return null;
}
