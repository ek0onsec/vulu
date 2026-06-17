"use client";
import { useEffect } from "react";
import { initialTheme, applyTheme } from "@/lib/theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => { applyTheme(initialTheme()); }, []);
  return <>{children}</>;
}

/**
 * À injecter dans <head> pour éviter le flash de thème clair au chargement.
 * Contenu = littéral statique ci-dessous (aucune donnée externe) → pas de risque XSS
 * malgré dangerouslySetInnerHTML ; c'est le pattern no-flash recommandé par Next.js.
 */
export const themeNoFlashScript =
  `(function(){try{var t=localStorage.getItem('vulu-theme');` +
  `if(!t){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}` +
  `document.documentElement.classList.toggle('dark',t==='dark');}catch(e){}})();`;
