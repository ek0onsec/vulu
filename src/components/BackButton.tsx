"use client";
import { useRouter } from "next/navigation";
import { Icon } from "./Icon";

export function BackButton({ fallback = "/feed", label = "Retour" }: { fallback?: string; label?: string }) {
  const router = useRouter();
  function back() {
    if (window.history.length > 1) router.back();
    else router.push(fallback);
  }
  return (
    <button onClick={back} aria-label={label}
      className="mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-border)] hover:text-[var(--color-text)]">
      <Icon name="back" size={18} /> {label}
    </button>
  );
}
