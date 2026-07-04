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

export function TourProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [welcome, setWelcome] = useState(false);
  const [running, setRunning] = useState(false);
  const [index, setIndex] = useState(0);
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

  // Navigue vers la route de l'étape courante APRÈS le rendu (jamais pendant).
  // La résolution/spotlight de la cible est gérée en continu par TourOverlay.
  useEffect(() => {
    if (!running) return;
    const step = TOUR_STEPS[index];
    if (!step) return;
    if (window.location.pathname !== step.route) router.push(step.route);
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
        <TourOverlay step={step} index={index} total={TOUR_STEPS.length}
          onPrev={prev} onNext={next} onSkip={skip} />
      )}
    </Ctx.Provider>
  );
}
