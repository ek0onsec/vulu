"use client";

export function WelcomeModal({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-[min(26rem,100%)] overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
        <div className="bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] p-6 text-white">
          <p className="font-display text-3xl font-black leading-tight">Bienvenue sur vulu 👋</p>
          <p className="mt-2 text-sm text-white/90">Ton réseau pour partager films, séries et livres. On te montre comment ça marche ?</p>
        </div>
        <div className="flex flex-col gap-2 p-5">
          <button onClick={onStart} className="w-full rounded-full bg-[var(--color-primary)] py-3 text-base font-bold text-white active:scale-[0.98]">Faire le tour ✨</button>
          <button onClick={onSkip} className="w-full rounded-full border border-[var(--color-border)] py-3 text-sm font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)]">Explorer seul</button>
        </div>
      </div>
    </div>
  );
}
