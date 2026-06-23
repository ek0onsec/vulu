"use client";
import { useEffect } from "react";
import { initialTheme, applyTheme, restoreSavedPalette } from "@/lib/theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => { applyTheme(initialTheme()); restoreSavedPalette(); }, []);
  return <>{children}</>;
}
