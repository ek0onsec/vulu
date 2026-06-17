"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  { href: "/feed", label: "Feed", icon: "🏠" },
  { href: "/search", label: "Recherche", icon: "🔍" },
  { href: "/lists", label: "Mes listes", icon: "🗂️" },
  { href: "/u/me", label: "Profil", icon: "👤" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const active = (href: string) => path === href || path.startsWith(href + "/");
  return (
    <div className="min-h-screen md:grid md:grid-cols-[220px_1fr]">
      <aside className="hidden flex-col gap-1 border-r border-[var(--color-border)] bg-[var(--color-surface)] p-4 md:flex">
        <div className="font-display px-2 pb-4 text-3xl font-bold text-[var(--color-primary)]">vulu</div>
        {NAV.map((n) => (
          <Link
            key={n.href} href={n.href}
            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
              active(n.href)
                ? "bg-[color-mix(in_srgb,var(--color-primary)_15%,transparent)] font-semibold text-[var(--color-primary)]"
                : "text-[var(--color-text)] hover:bg-[var(--color-border)]"
            }`}
          >
            <span>{n.icon}</span>{n.label}
          </Link>
        ))}
        <div className="mt-2"><ThemeToggle /></div>
      </aside>

      <main className="mx-auto w-full max-w-2xl px-3 pb-24 pt-4 md:pb-8">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-10 flex justify-around border-t border-[var(--color-border)] bg-[var(--color-surface)] py-2 md:hidden">
        {NAV.map((n) => (
          <Link
            key={n.href} href={n.href} aria-label={n.label}
            className={`text-xl ${active(n.href) ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"}`}
          >
            {n.icon}
          </Link>
        ))}
      </nav>
    </div>
  );
}
