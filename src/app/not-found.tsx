import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-display text-6xl font-bold text-[var(--color-primary)]">404</p>
      <h1 className="font-display text-2xl font-bold">Page introuvable</h1>
      <p className="max-w-sm text-sm text-[var(--color-text-muted)]">
        Cette page n’existe pas ou a été déplacée. Retourne à ton feed pour continuer.
      </p>
      <Link href="/feed" className="rounded-full bg-[var(--color-primary)] px-6 py-2.5 text-sm font-semibold text-white">
        Retour au feed
      </Link>
    </main>
  );
}
