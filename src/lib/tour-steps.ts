import type { TourStep } from "./tour-target";

export const TOUR_STEPS: TourStep[] = [
  { id: "feed", route: "/feed", target: "feed-card", fallbackTarget: "nav-feed", placement: "bottom",
    title: "Ton feed", body: "Les avis et activités de ton cercle apparaissent ici." },
  { id: "search", route: "/search", target: "search-input", fallbackTarget: "nav-search", placement: "bottom",
    title: "Rechercher", body: "Trouve un film, une série, un livre… ou un membre avec @pseudo." },
  { id: "notifications", route: "/notifications", target: "notifications-heading", fallbackTarget: "nav-notifications", placement: "bottom",
    title: "Notifications", body: "Likes, commentaires et nouveaux abonnés te sont signalés ici." },
  { id: "communities", route: "/communautes", target: "community-cta", fallbackTarget: "nav-communities", placement: "bottom",
    title: "Communautés", body: "Rejoins des communautés autour de tes goûts (création réservée à vulu+)." },
  { id: "library", route: "/bibliotheque", target: "create-collection", fallbackTarget: "nav-library", placement: "bottom",
    title: "Ta bibliothèque", body: "Organise tes œuvres en collections, et suis ce que tu as vu / à voir." },
  { id: "profile", route: "/u/me", target: "profile-showcase", fallbackTarget: "nav-profile", placement: "top",
    title: "Ton profil", body: "Mets en avant tes œuvres cultes dans ta vitrine." },
  { id: "plus", route: "/plus", target: "plus-hero", fallbackTarget: "nav-plus", placement: "bottom",
    title: "vulu+", body: "Débloque la création de communautés, les thèmes et plus encore." },
  { id: "settings", route: "/parametres", target: "settings-accessibility", fallbackTarget: "nav-settings", placement: "bottom",
    title: "Paramètres", body: "Compte, confidentialité, affichage… et l'accès à ce tutoriel." },
  { id: "end", route: "/feed", target: "center", placement: "center",
    title: "Tu es prêt·e ✨", body: "Tu pourras relancer ce tour à tout moment depuis Paramètres → Accessibilité." },
];
