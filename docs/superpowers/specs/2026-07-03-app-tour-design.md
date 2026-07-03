# App Tour — tutoriel guidé multi-pages (onboarding interactif)

**Statut :** design validé (2026-07-03).

**Contexte :** à la première connexion, une modale de bienvenue propose un « app tour ». S'il accepte, l'utilisateur suit un tutoriel qui se superpose à l'app : spotlight sur une feature, arrière-plan flouté, tooltip explicative, navigation guidée entre les pages. Skippable, relançable depuis Paramètres → Accessibilité → Tutoriel.

**Architecture :** App Next.js 16 (App Router), hexagonale côté serveur. La persistance (« tour vu ») passe par le domaine/application avec test vitest. Le moteur du tour est un composant client custom (sans librairie) monté dans `AppShell`, piloté par une liste d'étapes déclaratives ciblant des attributs `data-tour`.

## Décisions validées

1. **Ampleur** : tour **multi-pages guidé** (feed → recherche → bibliothèque → communautés → profil), avec navigation automatique et spotlight sur chaque page.
2. **Moteur** : **custom maison, sans librairie** — contrôle total du rendu premium (spotlight + flou + tooltip).
3. **Déclenchement** : modale de bienvenue à la **1ʳᵉ arrivée sur `/feed`**, si le tour n'a jamais été vu.
4. **Robustesse** : si la cible d'une page n'apparaît pas (feed vide, etc.), **repli sur l'item de nav** correspondant ; jamais de blocage.
5. **Parcours** : 6 étapes (feed, recherche, bibliothèque, communautés, profil, fin).

## Contraintes globales

- Aucune mention IA / Claude / superpowers dans le code, l'app ou les commits ; aucun co-auteur Claude.
- Ne jamais toucher au dossier `lechatonfat/`.
- Architecture hexagonale : toute dépendance externe derrière un port ; le domaine ne connaît aucun driver/SDK.
- Aucun secret en dur ; validation des entrées aux frontières ; typage strict, pas de `any`.
- Commits fréquents, un par tâche, directement sur `master`.
- Vérifier avant de conclure : `npx tsc --noEmit` propre + `npx vitest run` vert.

---

## Composant 1 — Persistance « tour vu »

**Modèle :** ajouter `tourCompletedAt: Date | null` à `User` (null = jamais vu/complété le tour). Mappers Mongo/memory par défaut `null` (rétrocompat). Sérialisé dans `selfUser` (donc renvoyé par `/api/me`).
**Application :** `markTourSeen(deps, userId): Promise<User>` — pose `deps.clock.now()` sur `tourCompletedAt` (idempotent : réappeler ne casse rien). Test vitest.
**API :** `POST /api/me/tour-seen` → `markTourSeen`, renvoie l'utilisateur sérialisé.
**Sémantique :**
- `tourCompletedAt === null` → afficher la modale de bienvenue à la 1ʳᵉ arrivée sur `/feed`.
- Accepter, terminer ou skipper le tour → appeler `POST /api/me/tour-seen` (le flag est posé, plus d'auto-affichage).
- La relance depuis les paramètres **ignore** le flag (démarre le tour sans le remettre à zéro).
**Fichiers :** `src/server/domain/entities.ts`, `src/server/application/tour.ts` (nouveau), `src/server/adapters/mongo/mappers.ts`, `src/lib/serialize.ts`, `src/app/api/me/tour-seen/route.ts` (nouveau), `tests/application/tour.test.ts`.

## Composant 2 — Définition des étapes

**Type :** `TourStep = { id: string; route: string; target: string; fallbackTarget?: string; title: string; body: string; placement: "top" | "bottom" | "left" | "right" | "center" }`. `target`/`fallbackTarget` sont des valeurs d'attribut `data-tour` (ex. `"nav-feed"`).
**Liste `TOUR_STEPS` (6 étapes) :**
1. `route:"/feed"`, `target:"feed-card"`, `fallbackTarget:"nav-feed"` — « Ton feed : les avis de ton cercle. »
2. `route:"/search"`, `target:"search-input"`, `fallbackTarget:"nav-search"` — « Cherche films, séries, livres… ou @membres. »
3. `route:"/bibliotheque"`, `target:"create-collection"`, `fallbackTarget:"nav-library"` — « Organise tes œuvres en collections. »
4. `route:"/communautes"`, `target:"community-cta"`, `fallbackTarget:"nav-communities"` — « Rejoins ou crée des communautés. »
5. `route:"/u/me"`, `target:"profile-showcase"`, `fallbackTarget:"nav-profile"` — « Ton profil et ta vitrine. »
6. `route:"/feed"`, `target:"center"`, `placement:"center"` — « Relance ce tour depuis Paramètres → Accessibilité. »
**Fichiers :** `src/lib/tour-steps.ts` (nouveau).

## Composant 3 — Moteur & overlay (custom)

**`TourProvider`** (client, monté dans `AppShell` autour de `{children}`) : contexte exposant `startTour()` et l'état (`running`, `stepIndex`). Récupère `tourCompletedAt` (via le `/api/me` déjà chargé par `AppShell`, passé en prop, ou refetch léger). À la 1ʳᵉ arrivée sur `/feed` avec `tourCompletedAt === null`, affiche la **modale de bienvenue**.
**Résolution de cible :** `resolveTarget(step)` = `document.querySelector('[data-tour="' + step.target + '"]')`, sinon `fallbackTarget`, sinon `null` (placement `center`). Fonction pure testable pour le choix `target → fallback → center` (logique séparée du DOM).
**Attente après navigation :** au passage à une étape sur une autre route, `router.push(step.route)` puis polling borné (`waitForTarget`, ~3 s, intervalle 100 ms) de la cible ; timeout → repli fallback/center.
**Overlay Spotlight** (`TourOverlay`) : mesure `getBoundingClientRect()` de la cible ; rend 4 panneaux sombres **floutés** (`backdrop-blur`) autour du trou (haut/bas/gauche/droite) laissant la cible nette, un anneau lumineux (`ring`/`box-shadow`) autour, et une **tooltip card** positionnée selon `placement` (titre, texte, points de progression, boutons *Précédent / Suivant / Passer*). Recalcul sur `resize`/`scroll` ; `scrollIntoView({ block: "center" })` de la cible avant l'affichage. `placement:"center"` → pas de trou, tooltip centrée.
**Contrôles :** *Suivant* (dernière étape → *Terminer*), *Précédent* (désactivé à l'étape 0), *Passer* (croix). *Terminer*/*Passer* → `POST /api/me/tour-seen` + fermeture.
**Fichiers :** `src/components/tour/TourProvider.tsx`, `src/components/tour/TourOverlay.tsx`, `src/components/tour/WelcomeModal.tsx`, `src/lib/tour-target.ts` (résolution pure + test), `src/components/AppShell.tsx` (montage), `tests/lib/tour-target.test.ts`.

## Composant 4 — Cibles `data-tour`

Poser `data-tour="…"` sur :
- Items de nav **desktop ET mobile** : `nav-feed`, `nav-search`, `nav-library`, `nav-communities`, `nav-profile` (`AppShell` — le moteur cible l'élément visible, `querySelector` prend le premier rendu ; les items cachés en `hidden` renvoient un rect vide → le moteur choisit un élément avec un rect non nul).
- `search-input` (`SearchPanel`), `create-collection` (bouton « Collection » de `LibraryClient`), `community-cta` (hero/bouton de `CommunitiesClient`), `profile-showcase` (bloc vitrine de `ProfileTabs`).
**Fichiers :** `src/components/AppShell.tsx`, `src/components/SearchPanel.tsx`, `src/app/bibliotheque/LibraryClient.tsx`, `src/app/communautes/CommunitiesClient.tsx`, `src/components/ProfileTabs.tsx`.

## Composant 5 — Modale de bienvenue (premium)

Carte centrée sur backdrop flouté : titre « Bienvenue sur vulu 👋 », sous-titre (« Fais le tour pour découvrir comment ça marche »), deux CTA — **« Faire le tour ✨ »** (`startTour()`) et **« Explorer seul »** (`POST /api/me/tour-seen` + fermeture). Design soigné (frontend-design à l'implémentation : dégradé de marque, typographie `font-display`).
**Fichiers :** `src/components/tour/WelcomeModal.tsx`.

## Composant 6 — Paramètres → Accessibilité → Tutoriel

Nouvelle section « Accessibilité » dans `SECTIONS` de `SettingsClient` (nouvel `SectionId` `"accessibility"`), avec un bouton **« (Re)lancer l'app tour »** appelant `useTour().startTour()`. `SettingsClient` étant rendu dans `AppShell` (donc sous `TourProvider`), le hook est disponible.
**Fichiers :** `src/app/parametres/SettingsClient.tsx`.

---

## Testing

- **Unit (vitest) :** `markTourSeen` (pose le timestamp, idempotent) ; `resolveTarget` pur (target présent → target ; absent → fallback ; les deux absents → center).
- **Manuel :** modale de bienvenue à la 1ʳᵉ connexion ; déroulé des 6 étapes desktop + mobile (spotlight net, arrière-plan flouté, navigation entre pages, repli si cible absente) ; skip → plus d'auto-affichage ; relance depuis Paramètres → Accessibilité.

## Décisions & bords

- **Feed vide / cible absente** : repli sur l'item de nav ; sinon tooltip centrée. Jamais de blocage.
- **Idempotence** : `markTourSeen` réappelé ne change pas la sémantique ; la relance manuelle ne réinitialise pas le flag.
- **Portée** : le tour ne s'affiche que dans `AppShell` (pages authentifiées) ; login/register/onboarding en sont exclus.
- **Rétrocompat** : utilisateurs existants → `tourCompletedAt = null` au prochain chargement ⇒ ils verront la modale une fois. Acceptable (découverte de la feature).

## Self-Review (couverture demande)

| Demande utilisateur | Composant |
|---|---|
| Modale de bienvenue à la 1ʳᵉ connexion proposant l'app tour | 1, 5 |
| Refuser (découvrir seul) ou accepter | 5 |
| Tutoriel superposé indiquant où cliquer + explications | 2, 3 |
| Design premium, floutage d'arrière-plan pour focus une feature | 3, 5 |
| Skip possible | 3 |
| Relançable depuis Paramètres → Accessibilité → Tutoriel | 6 |

Toutes les demandes sont couvertes. Périmètre cohérent pour un seul plan d'implémentation.
