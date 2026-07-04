"use client";
import { useEffect, useRef, useState } from "react";
import type { TourStep } from "@/lib/tour-target";

interface Rect { top: number; left: number; width: number; height: number }

function elementRect(el: Element | null): Rect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/** Cible visible pour l'étape : cible principale, sinon repli. */
function findTarget(step: TourStep): Element | null {
  const q = (name: string) => {
    const el = document.querySelector(`[data-tour="${name}"]`);
    return el && elementRect(el) ? el : null;
  };
  return q(step.target) ?? (step.fallbackTarget ? q(step.fallbackTarget) : null);
}

export function TourOverlay({ step, index, total, onPrev, onNext, onSkip }: {
  step: TourStep; index: number; total: number;
  onPrev: () => void; onNext: () => void; onSkip: () => void;
}) {
  const [rect, setRect] = useState<Rect | null>(null);
  const scrolledFor = useRef<string | null>(null);

  // Résolution CONTINUE de la cible : dès qu'elle est montée (après un squelette /
  // chargement), le halo s'y applique et suit les changements de layout.
  useEffect(() => {
    setRect(null);
    if (step.placement === "center") return;

    const recompute = () => {
      const el = findTarget(step);
      setRect(elementRect(el));
      if (el && scrolledFor.current !== step.id) {
        scrolledFor.current = step.id;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    };
    recompute();
    const interval = setInterval(recompute, 200);
    window.addEventListener("resize", recompute);
    window.addEventListener("scroll", recompute, true);
    return () => { clearInterval(interval); window.removeEventListener("resize", recompute); window.removeEventListener("scroll", recompute, true); };
  }, [step]);

  const pad = 8;
  const hole = rect ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 } : null;
  // Assombrissement très léger, SANS flou : la page reste nette et lisible.
  const panel = "fixed bg-black/10";

  const tipStyle: React.CSSProperties = hole
    ? step.placement === "top"
      ? { position: "fixed", left: Math.max(12, Math.min(hole.left, window.innerWidth - 340)), top: Math.max(12, hole.top - 12), transform: "translateY(-100%)" }
      : { position: "fixed", left: Math.max(12, Math.min(hole.left, window.innerWidth - 340)), top: hole.top + hole.height + 12 }
    : { position: "fixed", left: "50%", top: "50%", transform: "translate(-50%, -50%)" };

  return (
    <div className="fixed inset-0 z-[80]">
      {hole ? (
        <>
          <div className={panel} style={{ top: 0, left: 0, width: "100vw", height: Math.max(0, hole.top) }} />
          <div className={panel} style={{ top: hole.top + hole.height, left: 0, width: "100vw", height: `calc(100vh - ${hole.top + hole.height}px)` }} />
          <div className={panel} style={{ top: hole.top, left: 0, width: Math.max(0, hole.left), height: hole.height }} />
          <div className={panel} style={{ top: hole.top, left: hole.left + hole.width, width: `calc(100vw - ${hole.left + hole.width}px)`, height: hole.height }} />
          <div className="pointer-events-none fixed rounded-xl ring-4 ring-[var(--color-primary)] shadow-[0_0_0_3px_#fff,0_0_28px_8px_color-mix(in_srgb,var(--color-primary)_60%,transparent)]"
            style={{ top: hole.top, left: hole.left, width: hole.width, height: hole.height }} />
        </>
      ) : step.placement === "center" ? (
        <div className="fixed inset-0 bg-black/10" />
      ) : null}

      <div style={tipStyle} className="w-[min(20rem,calc(100vw-24px))] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-2xl">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-[var(--color-text-muted)]">Étape {index + 1}/{total}</span>
          <button onClick={onSkip} className="text-xs font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)]">Passer</button>
        </div>
        <p className="font-display text-lg font-bold">{step.title}</p>
        <p className="mt-1 text-sm text-[var(--color-text)]">{step.body}</p>
        <div className="mt-3 flex items-center gap-2">
          <button onClick={onPrev} disabled={index === 0}
            className="rounded-full border border-[var(--color-border)] px-4 py-1.5 text-sm font-semibold disabled:opacity-40">Précédent</button>
          <button onClick={onNext}
            className="ml-auto rounded-full bg-[var(--color-primary)] px-5 py-1.5 text-sm font-bold text-white active:scale-[0.98]">
            {index === total - 1 ? "Terminer" : "Suivant"}
          </button>
        </div>
      </div>
    </div>
  );
}
