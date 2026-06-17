"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { Icon, type IconName } from "./Icon";
import { DiscoverRail } from "./DiscoverRail";
import { api } from "@/lib/api-client";

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/feed", label: "Feed", icon: "home" },
  { href: "/search", label: "Recherche", icon: "search" },
  { href: "/lists", label: "Mes listes", icon: "lists" },
  { href: "/u/me", label: "Profil", icon: "profile" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const active = (href: string) => path === href || path.startsWith(href + "/");

  async function logout() {
    await api.post("/api/auth/logout").catch(() => {});
    router.push("/login");
  }

  return (
    <div className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 md:grid-cols-[230px_1fr] lg:grid-cols-[230px_minmax(0,1fr)_300px]">
      <aside className="sticky top-0 hidden h-screen flex-col gap-1 border-r border-[var(--color-border)] px-3 py-4 md:flex">
        <Link href="/feed" className="font-display mb-3 px-3 text-3xl font-bold text-[var(--color-primary)]">vulu</Link>
        {NAV.map((n) => (
          <Link key={n.href} href={n.href}
            className={`flex items-center gap-3 rounded-full px-3 py-2.5 text-[0.95rem] transition-colors ${
              active(n.href)
                ? "bg-[color-mix(in_srgb,var(--color-primary)_14%,transparent)] font-semibold text-[var(--color-primary)]"
                : "text-[var(--color-text)] hover:bg-[var(--color-border)]"
            }`}>
            <Icon name={n.icon} />{n.label}
          </Link>
        ))}
        <div className="mt-1 flex items-center gap-1 px-1">
          <ThemeToggle />
          <button onClick={logout} aria-label="Se déconnecter"
            className="rounded-full p-2 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-border)]">
            <Icon name="logout" size={20} />
          </button>
        </div>
      </aside>

      <main className="w-full border-x border-[var(--color-border)] px-3 pb-24 pt-4 md:px-5 md:pb-8">{children}</main>

      <aside className="sticky top-0 hidden h-screen overflow-y-auto px-4 py-5 lg:block">
        <DiscoverRail />
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-10 flex justify-around border-t border-[var(--color-border)] bg-[var(--color-surface)] py-2 md:hidden">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} aria-label={n.label}
            className={`rounded-full p-2 ${active(n.href) ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"}`}>
            <Icon name={n.icon} size={24} />
          </Link>
        ))}
      </nav>
    </div>
  );
}
