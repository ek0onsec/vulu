"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { Icon, type IconName } from "./Icon";
import { Avatar } from "./Avatar";
import { CertifiedBadge } from "./CertifiedBadge";
import { StaffBadge } from "./StaffBadge";
import { DiscoverRail } from "./DiscoverRail";
import { SideMenu } from "./SideMenu";
import { api } from "@/lib/api-client";

const NAV: { href: string; label: string; icon: IconName; pulse?: boolean }[] = [
  { href: "/feed", label: "Feed", icon: "home", pulse: true },
  { href: "/search", label: "Recherche", icon: "search" },
  { href: "/notifications", label: "Notifications", icon: "bell" },
  { href: "/communautes", label: "Communautés", icon: "community" },
  { href: "/bibliotheque", label: "Bibliothèque", icon: "lists" },
  { href: "/u/me", label: "Profil", icon: "profile" },
  { href: "/plus", label: "vulu+", icon: "star" },
  { href: "/parametres", label: "Paramètres", icon: "settings" },
];

// Barre du bas (mobile) : 4 entrées. Recherche = island flottante ; profil/réglages/vulu+ = side menu.
const BOTTOM_NAV: { href: string; label: string; icon: IconName; pulse?: boolean }[] = [
  { href: "/feed", label: "Accueil", icon: "home", pulse: true },
  { href: "/communautes", label: "Communautés", icon: "community" },
  { href: "/bibliotheque", label: "Bibliothèque", icon: "lists" },
  { href: "/notifications", label: "Notifications", icon: "bell" },
];

interface Me { username: string; displayName: string; avatarUrl: string | null; plus: boolean; staff: boolean; private: boolean; followers: number; following: number }

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const active = (href: string) => path === href || path.startsWith(href + "/");
  const [me, setMe] = useState<Me | null>(null);
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    api.get<{ user: Omit<Me, "followers" | "following">; followers: number; following: number }>("/api/me")
      .then((d) => setMe({ ...d.user, followers: d.followers, following: d.following }))
      .catch(() => setMe(null));
  }, []);

  // Compteur de notifications non lues, rafraîchi à chaque navigation.
  useEffect(() => {
    api.get<{ unreadCount: number }>("/api/notifications/count").then((d) => setUnread(d.unreadCount)).catch(() => {});
  }, [path]);

  // Ferme le side menu à chaque navigation.
  useEffect(() => { setMenuOpen(false); }, [path]);

  async function logout() {
    await api.post("/api/auth/logout").catch(() => {});
    router.push("/login");
  }

  return (
    <div className="mx-auto grid min-h-screen max-w-[1320px] grid-cols-1 md:grid-cols-[240px_1fr] lg:grid-cols-[240px_minmax(0,1fr)_340px]">
      <aside className="sticky top-0 hidden h-screen flex-col gap-1 border-r border-[var(--color-border)] px-3 py-4 md:flex">
        <Link href="/feed" className="font-display mb-3 px-3 text-3xl font-bold text-[var(--color-primary)]">vulu</Link>
        {NAV.map((n) => (
          <Link key={n.href} href={n.href}
            className={`flex items-center gap-3 rounded-full px-3 py-2.5 text-[0.95rem] transition-colors ${
              active(n.href)
                ? "bg-[color-mix(in_srgb,var(--color-primary)_14%,transparent)] font-semibold text-[var(--color-primary)]"
                : "text-[var(--color-text)] hover:bg-[var(--color-border)]"
            }`}>
            <span className="relative inline-flex">
              <Icon name={n.icon} />
              {n.pulse && !active(n.href) && (
                <span className="absolute -right-1 -top-1 flex h-2.5 w-2.5" title="Nouveau contenu — clique pour actualiser">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-accent)] opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--color-accent)]" />
                </span>
              )}
              {n.icon === "bell" && unread > 0 && (
                <span className="absolute -right-2 -top-2 flex min-w-[1.1rem] items-center justify-center rounded-full bg-[var(--color-primary)] px-1 text-[0.65rem] font-bold leading-4 text-white">{unread > 9 ? "9+" : unread}</span>
              )}
            </span>
            {n.label}
          </Link>
        ))}
        <div className="mt-auto flex flex-col gap-1 pt-2">
          <div className="px-1"><ThemeToggle /></div>
          {me && (
            <div className="flex items-center gap-2 rounded-2xl border border-[var(--color-border)] p-2">
              <Link href="/u/me" className="flex min-w-0 flex-1 items-center gap-2">
                <Avatar name={me.displayName} src={me.avatarUrl} size={36} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">
                    {me.displayName}{me.staff && <StaffBadge size={13} />}{me.plus && <CertifiedBadge size={13} />}
                  </span>
                  <span className="flex items-center gap-1 truncate text-xs text-[var(--color-text-muted)]">@{me.username}{me.private && <Icon name="lock" size={11} />}</span>
                </span>
              </Link>
              <button onClick={logout} aria-label="Se déconnecter"
                className="rounded-full p-2 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-border)]">
                <Icon name="logout" size={18} />
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className="w-full border-x border-[var(--color-border)] px-3 pb-24 pt-4 md:px-5 md:pb-8">
        <div className="sticky top-0 z-40 -mx-3 mb-2 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)]/90 px-3 py-2 backdrop-blur md:hidden">
          <Link href="/feed" className="font-display text-2xl font-bold text-[var(--color-primary)]">vulu</Link>
          <button onClick={() => setMenuOpen(true)} aria-label="Ouvrir le menu">
            {me && <Avatar name={me.displayName} src={me.avatarUrl} size={32} />}
          </button>
        </div>
        {children}
      </main>

      <aside className="sticky top-0 hidden h-screen overflow-y-auto px-4 py-5 lg:block">
        <DiscoverRail />
      </aside>

      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} me={me} onLogout={logout} />

      <nav className="fixed inset-x-0 bottom-0 z-10 flex justify-around border-t border-[var(--color-border)] bg-[var(--color-surface)] py-2 md:hidden">
        {BOTTOM_NAV.map((n) => (
          <Link key={n.href} href={n.href} aria-label={n.label}
            className={`relative rounded-full p-2 ${active(n.href) ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"}`}>
            <Icon name={n.icon} size={24} />
            {n.pulse && !active(n.href) && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 animate-ping rounded-full bg-[var(--color-accent)]" />
            )}
            {n.icon === "bell" && unread > 0 && (
              <span className="absolute right-0.5 top-0.5 flex min-w-[1.1rem] items-center justify-center rounded-full bg-[var(--color-primary)] px-1 text-[0.6rem] font-bold leading-4 text-white">{unread > 9 ? "9+" : unread}</span>
            )}
          </Link>
        ))}
      </nav>
    </div>
  );
}
