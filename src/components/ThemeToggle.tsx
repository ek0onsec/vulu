"use client";
import { useEffect, useState } from "react";
import { type Theme, applyTheme, initialTheme } from "@/lib/theme";
import { Icon } from "./Icon";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => { setTheme(initialTheme()); }, []);
  function toggle() { const next: Theme = theme === "dark" ? "light" : "dark"; setTheme(next); applyTheme(next); }
  return (
    <button onClick={toggle} aria-label="Basculer le thème"
      className="rounded-full p-2 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-border)]">
      <Icon name={theme === "dark" ? "sun" : "moon"} size={20} />
    </button>
  );
}
