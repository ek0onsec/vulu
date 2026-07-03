# Batch 4 — Teaser communauté vulu+ proéminent, édition de collection, réordonnancement de la vitrine par drag

**Statut :** design validé (2026-07-03).

**Contexte :** quatrième lot, surtout UI. (1) Rendre le teaser « Créer une communauté avec vulu+ » proéminent (desktop + mobile) ; (2) permettre de renommer/éditer une collection (nom + description) ; (3) réordonner les affiches de la vitrine par glisser-déposer tactile.

**Architecture :** App Next.js 16 (App Router), hexagonale côté serveur. Ces trois features sont quasi exclusivement front : les endpoints backend nécessaires existent déjà (`PATCH /api/lists/[id]` + `updateList`, `PUT /api/me/showcase` + `updateShowcase`). Aucune modification domaine/application.

## Décisions validées

1. **F1 teaser** : hero pleine largeur avec grande typo de fond, visible uniquement pour les **non-vulu+** ; les vulu+ conservent le bouton « Créer ».
2. **F2 édition collection** : rendre modifiables **nom + description** (le backend accepte déjà `name`/`description` via `createListSchema`).
3. **F3 vitrine** : glisser-déposer réel avec **@dnd-kit** (support tactile mobile), pas de drag HTML natif ni de flèches.

## Contraintes globales

- Aucune mention IA / Claude / superpowers dans le code, l'app ou les commits ; aucun co-auteur Claude.
- Ne jamais toucher au dossier `lechatonfat/`.
- Architecture hexagonale : toute dépendance externe derrière un port ; le domaine ne connaît aucun driver/SDK.
- Aucun secret en dur ; validation des entrées aux frontières ; typage strict, pas de `any`.
- Commits fréquents, un par tâche, directement sur `master`.
- Vérifier avant de conclure : `npx tsc --noEmit` propre + `npx vitest run` vert.

---

## F1 — Teaser communauté vulu+ proéminent

**État actuel :** `CommunitiesClient.tsx` affiche déjà, pour `!plus`, un bloc dégradé « Crée ta communauté avec vulu+ » (batch 2), mais discret.
**Objectif :** un hero pleine largeur avec une **grande typographie de fond** « Créer une communauté avec vulu+ », lisible et soigné en desktop et mobile, cliquable vers `/plus`, réservé aux non-vulu+.
**Approche :** remplacer le bloc actuel par un hero plus grand : grande accroche `font-display` en plusieurs tailles responsives, mot « vulu+ » en filigrane de fond (grand, faible opacité) adapté desktop/mobile, CTA « Débloquer avec vulu+ ». Aucun backend.
**Fichiers :** `src/app/communautes/CommunitiesClient.tsx`.

## F2 — Renommer / éditer une collection

**État actuel :** `ListDetailModal` (mode `editable`) permet de changer la bannière et d'ajouter/retirer des œuvres, mais **pas** le nom ni la description. Le backend `PATCH /api/lists/[id]` (route existante) appelle `updateList(deps, userId, listId, { name, kind, description, visibility })`.
**Objectif :** pouvoir renommer et éditer la description d'une collection à tout moment.
**Approche :** dans `ListDetailModal`, à côté du titre (mode `editable`), ajouter un bouton crayon qui ouvre un petit formulaire inline (champ nom + champ description). À la validation, appeler `PATCH /api/lists/${listId}` avec `{ name, kind: list.kind, description, visibility: list.visibility }` (les champs non édités repris de la liste chargée), rafraîchir (`refresh()`), toast. Validation front minimale (nom non vide, ≤ 60 ; description ≤ 300) alignée sur `createListSchema`. Aucun backend.
**Fichiers :** `src/components/ListDetailModal.tsx`.

## F3 — Réordonnancement de la vitrine par glisser-déposer

**État actuel :** `ShowcaseManager` (dans `ProfileTabs.tsx`) gère l'ajout/retrait des œuvres de la vitrine (max 5 par catégorie) et persiste l'ordre via `persist(next)` → `PUT /api/me/showcase` avec `{ movie: workIds[], tv: workIds[], book: workIds[] }`. L'ordre du tableau EST l'ordre d'affichage. Il manque le réordonnancement.
**Objectif :** glisser une affiche pour la repositionner dans l'ordre voulu, au doigt (mobile) et à la souris (desktop).
**Approche :** ajouter **@dnd-kit** (`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`). Dans `ShowcaseManager`, chaque catégorie affichée (Films / Séries / Livres) devient une grille *sortable* :
- un `DndContext` avec `PointerSensor` (activation après petit déplacement pour ne pas gêner le tap) englobe un `SortableContext` (stratégie grille) par catégorie ;
- chaque affiche est un item `useSortable` (poignée = l'affiche entière) ;
- à `onDragEnd`, `arrayMove` réordonne `sc[cat]`, puis `persist(next)` envoie le nouvel ordre.
Le bouton « retirer » reste (clic distinct du drag grâce au seuil d'activation du capteur). Aucun changement backend (l'ordre passe déjà par l'API existante).
**Fichiers :** `src/components/ProfileTabs.tsx`, `package.json` (+ `package-lock.json`).

---

## Testing

- F1/F2/F3 sont des changements d'UI ; vérification `npx tsc --noEmit` + build, et validation visuelle (F3 surtout sur mobile réel pour le drag tactile).
- La persistance de F2 et F3 passe par des endpoints/use-cases déjà couverts par les tests existants (`updateList`, `updateShowcase`) — pas de nouveau test unitaire requis. Si un helper pur est extrait (peu probable), il sera testé.

## Self-Review (couverture demande)

| Demande utilisateur | Feature |
|---|---|
| Onglet Communauté : « Créer une communauté avec vulu+ » en grand sur le fond (desktop + mobile) | F1 |
| Pouvoir changer le nom d'une collection à tout moment | F2 |
| Vitrine : drag des affiches pour les ordonner | F3 |

Toutes les demandes sont couvertes. Chaque feature est indépendamment livrable.
