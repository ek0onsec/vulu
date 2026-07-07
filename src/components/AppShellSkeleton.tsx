import type { ReactNode } from "react";

export function Skel({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-[var(--color-border)] ${className}`} />;
}

export function AppShellSkeleton({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto grid min-h-screen max-w-[1320px] grid-cols-1 md:grid-cols-[240px_1fr] lg:grid-cols-[240px_minmax(0,1fr)_340px]">
      {/* Sidebar gauche */}
      <aside className="sticky top-0 hidden h-screen flex-col gap-2 border-r border-[var(--color-border)] px-3 py-4 md:flex">
        <Skel className="mb-3 h-7 w-24 rounded-md" />
        {Array.from({ length: 6 }).map((_, i) => <Skel key={i} className="h-9 rounded-full" />)}
        <div className="mt-auto">
          <Skel className="h-14 rounded-2xl" />
        </div>
      </aside>

      {/* Colonne principale */}
      <main className="w-full border-x border-[var(--color-border)] px-3 pb-24 pt-4 md:px-5 md:pb-8">
        <div className="mb-3 flex items-center justify-between md:hidden">
          <Skel className="h-6 w-20 rounded-md" />
          <Skel className="h-8 w-8 rounded-full" />
        </div>
        {children}
      </main>

      {/* Rail droit */}
      <aside className="sticky top-0 hidden h-screen flex-col gap-3 px-4 py-5 lg:flex">
        {Array.from({ length: 3 }).map((_, i) => <Skel key={i} className="h-24 rounded-2xl" />)}
      </aside>

      {/* Nav mobile basse */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex justify-around border-t border-[var(--color-border)] bg-[var(--color-surface)] py-3 md:hidden">
        {Array.from({ length: 4 }).map((_, i) => <Skel key={i} className="h-6 w-6 rounded-full" />)}
      </nav>
    </div>
  );
}
