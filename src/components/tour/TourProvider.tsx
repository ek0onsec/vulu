"use client";
import { createContext, useContext, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { TOUR_STEPS } from "@/lib/tour-steps";
import { TourOverlay } from "./TourOverlay";
import { WelcomeModal } from "./WelcomeModal";

interface TourCtx { startTour: () => void }
const Ctx = createContext<TourCtx>({ startTour: () => {} });
export const useTour = () => useContext(Ctx);

/** Attend qu'une cible data-tour soit visible (borné). */
function waitForTarget(name: string, timeoutMs = 3000): Promise<Element | null> {
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      const el = document.querySelector(`[data-tour="${name}"]`);
      if (el) { const r = el.getBoundingClientRect(); if (r.width > 0 || r.height > 0) return resolve(el); }
      if (Date.now() - start > timeoutMs) return resolve(null);
      setTimeout(tick, 100);
    };
    tick();
  });
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [welcome, setWelcome] = useState(false);
  const [running, setRunning] = useState(false);
  const [index, setIndex] = useState(0);
  const [targetEl, setTargetEl] = useState<Element | null>(null);
  const shownWelcome = useRef(false);

  // Modale de bienvenue une fois, à la 1ʳᵉ arrivée sur /feed si tour jamais vu.
  useEffect(() => {
    if (shownWelcome.current || pathname !== "/feed") return;
    shownWelcome.current = true;
    api.get<{ user: { tourCompletedAt: string | null } }>("/api/me")
      .then((d) => { if (d.user.tourCompletedAt === null) setWelcome(true); })
      .catch(() => {});
  }, [pathname]);

  const markSeen = useCallback(() => { api.post("/api/me/tour-seen").catch(() => {}); }, []);

  // Charge l'étape courante APRÈS le rendu (effet) : navigue si besoin, attend la
  // cible (repli fallback), la résout. Jamais de router.push pendant le rendu.
  useEffect(() => {
    if (!running) return;
    const step = TOUR_STEPS[index];
    if (!step) return;
    let cancelled = false;
    setTargetEl(null);
    if (step.placement === "center") return;
    if (window.location.pathname !== step.route) router.push(step.route);
    (async () => {
      let finalName: string | null = null;
      const primary = await waitForTarget(step.target);
      if (cancelled) return;
      if (primary) finalName = step.target;
      else if (step.fallbackTarget) { const fb = await waitForTarget(step.fallbackTarget, 800); if (cancelled) return; if (fb) finalName = step.fallbackTarget; }
      if (cancelled) return;
      setTargetEl(finalName ? document.querySelector(`[data-tour="${finalName}"]`) : null);
    })();
    return () => { cancelled = true; };
  }, [running, index, router]);

  const startTour = useCallback(() => { setWelcome(false); setIndex(0); setRunning(true); }, []);
  const next = useCallback(() => {
    setIndex((i) => {
      if (i >= TOUR_STEPS.length - 1) { setRunning(false); markSeen(); return i; }
      return i + 1;
    });
  }, [markSeen]);
  const prev = useCallback(() => { setIndex((i) => Math.max(0, i - 1)); }, []);
  const skip = useCallback(() => { setRunning(false); markSeen(); }, [markSeen]);

  const step = TOUR_STEPS[index];

  return (
    <Ctx.Provider value={{ startTour }}>
      {children}
      {welcome && <WelcomeModal onStart={startTour} onSkip={() => { setWelcome(false); markSeen(); }} />}
      {running && step && (
        <TourOverlay step={step} index={index} total={TOUR_STEPS.length} targetEl={targetEl}
          onPrev={prev} onNext={next} onSkip={skip} />
      )}
    </Ctx.Provider>
  );
}
