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

  // Charge l'étape : navigue si besoin, attend la cible (repli fallback), la résout.
  const loadStep = useCallback(async (i: number) => {
    const step = TOUR_STEPS[i];
    if (!step) return;
    if (step.placement === "center") { setTargetEl(null); return; }
    if (pathname !== step.route) router.push(step.route);
    setTargetEl(null);
    let finalName: string | null = null;
    const primary = await waitForTarget(step.target);
    if (primary) finalName = step.target;
    else if (step.fallbackTarget) { const fb = await waitForTarget(step.fallbackTarget, 800); if (fb) finalName = step.fallbackTarget; }
    setTargetEl(finalName ? document.querySelector(`[data-tour="${finalName}"]`) : null);
  }, [pathname, router]);

  const startTour = useCallback(() => { setWelcome(false); setRunning(true); setIndex(0); void loadStep(0); }, [loadStep]);
  const finish = useCallback(() => { setRunning(false); markSeen(); }, [markSeen]);
  const next = useCallback(() => {
    setIndex((i) => {
      if (i >= TOUR_STEPS.length - 1) { finish(); return i; }
      const ni = i + 1; void loadStep(ni); return ni;
    });
  }, [finish, loadStep]);
  const prev = useCallback(() => { setIndex((i) => { const pi = Math.max(0, i - 1); void loadStep(pi); return pi; }); }, [loadStep]);
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
