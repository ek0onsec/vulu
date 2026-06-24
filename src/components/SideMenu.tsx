"use client";
import Link from "next/link";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { ThemeToggle } from "./ThemeToggle";
import { CertifiedBadge } from "./CertifiedBadge";
import { StaffBadge } from "./StaffBadge";

interface MenuUser { username: string; displayName: string; avatarUrl: string | null; plus: boolean; staff: boolean; private: boolean; followers: number; following: number }

const LINKS = [
  { href: "/u/me", label: "Profil", icon: "profile" as const },
  { href: "/plus", label: "vulu+", icon: "star" as const },
  { href: "/parametres", label: "Paramètres", icon: "settings" as const },
];

/** Panneau glissant depuis la gauche (mobile). Présentationnel : ouverture/fermeture pilotées par le parent. */
export function SideMenu({ open, onClose, me, onLogout }: { open: boolean; onClose: () => void; me: MenuUser | null; onLogout: () => void }) {
  return (
    <div className={`fixed inset-0 z-40 md:hidden ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <div onClick={onClose}
        className={`absolute inset-0 bg-black/40 transition-opacity ${open ? "opacity-100" : "opacity-0"}`} />
      <aside
        className={`absolute left-0 top-0 flex h-full w-[78%] max-w-xs flex-col gap-4 border-r border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-transform ${open ? "translate-x-0" : "-translate-x-full"}`}>
        {me && (
          <>
            <Link href="/u/me" onClick={onClose} className="flex flex-col gap-2">
              <Avatar name={me.displayName} src={me.avatarUrl} size={52} />
              <span>
                <span className="flex items-center gap-1 font-semibold">
                  {me.displayName}{me.staff && <StaffBadge size={14} />}{me.plus && <CertifiedBadge size={14} />}
                </span>
                <span className="flex items-center gap-1 text-sm text-[var(--color-text-muted)]">@{me.username}{me.private && <Icon name="lock" size={12} />}</span>
              </span>
            </Link>
            <div className="flex gap-4 text-sm">
              <span><strong>{me.following}</strong> <span className="text-[var(--color-text-muted)]">abonnements</span></span>
              <span><strong>{me.followers}</strong> <span className="text-[var(--color-text-muted)]">abonnés</span></span>
            </div>
          </>
        )}

        <nav className="flex flex-col gap-1 border-t border-[var(--color-border)] pt-3">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} onClick={onClose}
              className="flex items-center gap-3 rounded-xl px-2 py-2.5 text-[var(--color-text)] transition-colors hover:bg-[var(--color-border)]">
              <Icon name={l.icon} /> {l.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-2 border-t border-[var(--color-border)] pt-3">
          <div className="px-1"><ThemeToggle /></div>
          <button onClick={() => { onClose(); onLogout(); }}
            className="flex items-center gap-3 rounded-xl px-2 py-2.5 text-left text-[var(--color-text)] transition-colors hover:bg-[var(--color-border)]">
            <Icon name="logout" /> Se déconnecter
          </button>
        </div>
      </aside>
    </div>
  );
}
