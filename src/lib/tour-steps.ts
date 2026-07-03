import type { TourStep } from "./tour-target";

export const TOUR_STEPS: TourStep[] = [
  { id: "feed", route: "/feed", target: "feed-card", fallbackTarget: "nav-feed", placement: "bottom",
    title: "Ton feed", body: "Les avis et activités de ton cercle apparaissent ici." },
  { id: "search", route: "/search", target: "search-input", fallbackTarget: "nav-search", placement: "bottom",
    title: "Rechercher", body: "Trouve un film, une série, un livre… ou un membre avec @pseudo." },
  { id: "library", route: "/bibliotheque", target: "create-collection", fallbackTarget: "nav-library", placement: "bottom",
    title: "Ta bibliothèque", body: "Organise tes œuvres en collections, et suis ce que tu as vu / à voir." },
  { id: "communities", route: "/communautes", target: "community-cta", fallbackTarget: "nav-communities", placement: "bottom",
    title: "Communautés", body: "Rejoins des communautés autour de tes goûts (création réservée à vulu+)." },
  { id: "profile", route: "/u/me", target: "profile-showcase", fallbackTarget: "nav-profile", placement: "top",
    title: "Ton profil", body: "Mets en avant tes œuvres cultes dans ta vitrine." },
  { id: "end", route: "/feed", target: "center", placement: "center",
    title: "Tu es prêt·e ✨", body: "Tu pourras relancer ce tour à tout moment depuis Paramètres → Accessibilité." },
];
