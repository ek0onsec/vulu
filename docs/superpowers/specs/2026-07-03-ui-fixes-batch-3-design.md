# Batch 3 — Avis propre sur la fiche œuvre, backfill runtime, stats profil cliquables, bouton « Valider », réactivité

**Statut :** design validé (2026-07-03).

**Contexte :** troisième lot. Deux bugs (ton avis absent de la fiche œuvre, temps de visionnage invisible faute de `runtime` en base) + features UX (stats profil cliquables, bouton de validation proéminent, réactivité perçue).

**Architecture :** App Next.js 16 (App Router, Turbopack), hexagonale côté serveur (domain/application/ports/adapters). Les changements logiques (avis propre, backfill runtime, listes d'abonnés) passent par le domaine/application avec tests vitest ; l'UX (bouton, squelettes, feedback tactile) est vérifiée manuellement.

## Décisions validées

1. **Ton avis sur la fiche œuvre** : affiché en haut de la liste (badge « Ton avis ») **s'il est partagé** (public/cercle/communauté). Un avis « gardé pour moi » reste hors liste.
2. **Backfill runtime** : rafraîchissement auto borné. `getOrImportWork` re-récupère depuis TMDB une œuvre film/série dont `runtime` est `null` (backfill à la visite d'une fiche). Au chargement du profil, `computeWatchMinutes` backfille un nombre **borné** d'œuvres sans runtime par affichage (le reste se complète aux visites suivantes).
3. **Stats cliquables** : « vus »/« lus » défilent vers `ProfileTabs` et présélectionnent l'onglet via un hash ; « abonnés »/« abonnements » ouvrent une **modale** listant les utilisateurs.
4. **Réactivité** : squelettes `loading.tsx` par route clé + feedback tactile `:active` + préchargement des liens. **Pas** de barre de progression.

## Contraintes globales

- Aucune mention IA / Claude / superpowers dans le code, l'app ou les commits ; aucun co-auteur Claude.
- Ne jamais toucher au dossier `lechatonfat/`.
- Architecture hexagonale : toute dépendance externe derrière un port ; le domaine ne connaît aucun driver/SDK.
- Aucun secret en dur ; validation des entrées aux frontières ; typage strict, pas de `any`.
- Commits fréquents, un par tâche, directement sur `master`.
- Vérifier avant de conclure : `npx tsc --noEmit` propre + `npx vitest run` vert.

---

## Phase A — Bugs

### A1 — Ton avis partagé sur la fiche œuvre
**Cause :** `getWorkReviews(deps, viewerId, workId)` filtre `e.userId !== viewerId` : ta propre entrée est toujours exclue. Si tu es seul à avoir noté, « Avis de la communauté » affiche « Aucun avis » alors que ton avis existe.
**Approche :**
- Nouvelle fonction application `getMyWorkReview(deps, viewerId, workId): Promise<FeedItem | null>` : renvoie ton entrée sur l'œuvre si elle est **publishable** (`status === "done"` ET note ou texte) **et partagée** (`audiences.public || audiences.circle || audiences.communityIds.length > 0`), sinon `null`.
- L'endpoint `GET /api/works/[id]/reviews` renvoie `{ mine: FeedItem | null, others: FeedItem[] }` (`others` = `getWorkReviews`, inchangé).
- `WorkReviews` affiche `mine` en tête avec un badge « Ton avis », puis `others`. Le placeholder « Aucun avis » ne s'affiche que si `mine === null && others.length === 0`. La section se titre « Avis » (ou conserve « Avis de la communauté » pour la partie `others`).
**Tests :** vitest sur `getMyWorkReview` (partagé → renvoyé ; gardé pour soi → `null` ; non noté → `null`).
**Fichiers :** `src/server/application/feed.ts`, `src/app/api/works/[id]/reviews/route.ts`, `src/components/WorkReviews.tsx`, `tests/application/feed.test.ts`.

### A2 — Backfill du `runtime` (temps de visionnage invisible)
**Cause :** `getOrImportWork` renvoie le cache sans jamais le rafraîchir (`if (cached) return cached;`). Les œuvres importées avant l'ajout de `runtime` gardent `runtime = null` → `computeWatchMinutes` = 0 → stat masquée.
**Approche :**
- `getOrImportWork` : si l'œuvre en cache est un film/série avec `runtime === null`, re-récupérer les détails via `deps.catalog.getWork` et mettre à jour l'œuvre (backfill du `runtime`, et des autres champs récupérés) avant de la renvoyer. Films/séries uniquement (les livres n'ont pas de runtime). En cas d'échec catalogue, renvoyer le cache tel quel (pas de throw).
- `computeWatchMinutes` : au calcul, pour les œuvres film/série dont `runtime === null`, déclencher un backfill **borné** (constante `MAX_BACKFILL = 20` par appel) via un chemin qui re-récupère et persiste le runtime, puis inclure la valeur dans le total. Au-delà de la borne, les œuvres restantes sont ignorées ce tour-ci (complétées aux appels suivants).
**Tests :** vitest — une œuvre film avec `runtime: null` persistée, puis `computeWatchMinutes` la backfille depuis le FakeCatalog et renvoie la durée. Borne respectée.
**Fichiers :** `src/server/application/get-work.ts`, `src/server/application/watch-time.ts`, `tests/application/watch-time.test.ts`.

---

## Phase B — Stats profil cliquables

### B1 — « vus » / « lus » → onglet du profil
**Approche :** dans `src/app/u/[username]/page.tsx`, les compteurs « vus » et « lus » deviennent des liens ancre (`#vus` / `#lus`) qui défilent vers `ProfileTabs`. `ProfileTabs` lit `window.location.hash` au montage (`useEffect`) et présélectionne l'onglet correspondant (`vus` → onglet films vus, `lus` → onglet livres lus) si présent. Aucun endpoint.
**Fichiers :** `src/app/u/[username]/page.tsx`, `src/components/ProfileTabs.tsx`.

### B2 — « abonnés » / « abonnements » → modale
**Approche :**
- Application : `listFollowers(deps, userId): Promise<UserCard[]>` et `listFollowing(deps, userId): Promise<UserCard[]>` (nouveau module `src/server/application/follow-lists.ts`), où `UserCard = { id, username, displayName, avatarUrl, plus, staff }` (même forme que `UserSearchResult`). S'appuient sur `deps.follows.followerIdsOf` / `followeeIdsOf` + `deps.users.findById`.
- Endpoints : `GET /api/users/[username]/followers` et `GET /api/users/[username]/following` — résolvent l'utilisateur cible, vérifient la visibilité (`canViewProfile`) : si non autorisé (compte privé non suivi), renvoient `403`/liste vide selon le motif. Retournent `{ users: UserCard[] }`.
- UI : composant client `UserListModal` (avatar, pseudo + badges, `FollowButton`), réutilisable. Dans la page profil, les compteurs « abonnés »/« abonnements » deviennent des boutons ouvrant la modale (chargement à l'ouverture via l'endpoint). Un petit wrapper client (`ProfileStats`) porte l'état d'ouverture, car la page est un composant serveur.
**Tests :** vitest sur `listFollowers`/`listFollowing` (contenu correct, DTO minimal).
**Fichiers :** `src/server/application/follow-lists.ts`, `src/app/api/users/[username]/followers/route.ts`, `src/app/api/users/[username]/following/route.ts`, `src/components/UserListModal.tsx`, `src/components/ProfileStats.tsx`, `src/app/u/[username]/page.tsx`, `tests/application/follow-lists.test.ts`.

---

## Phase C — UX

### C1 — Bouton « Valider » proéminent
**Approche :** dans `src/components/EntryEditor.tsx`, le bouton principal (`onClick={save}`) : libellé « Enregistrer » → « Valider » ; style proéminent : pleine largeur (`w-full`), plus grand (`py-3 text-base`), couleur marquée (fond `--color-primary`, texte blanc), ombre (`shadow-[0_4px_16px_...]`), état `active:scale-[0.98]`. Les boutons « Enregistrer » de progression (jalons) restent, cohérents visuellement.
**Fichiers :** `src/components/EntryEditor.tsx`.

### C2 — Réactivité perçue
**Approche :**
- **Squelettes** : ajouter `loading.tsx` pour les routes clés — feed, profil (`u/[username]`), recherche, œuvre (`work/[id]`), bibliothèque, communautés — rendant un squelette (réutiliser les motifs `animate-pulse` déjà présents) affiché instantanément pendant le chargement serveur.
- **Feedback tactile** : classe `active:scale-[0.97] active:opacity-90 transition-transform` sur les boutons d'action principaux et les cartes cliquables (feed, posters, nav). Cibler les composants partagés (`FeedCard`, nav) pour un effet cohérent sans dupliquer.
- **Préchargement** : vérifier que les `Link` de navigation principale (`AppShell`/nav) et les cartes n'ont pas `prefetch={false}` ; laisser le prefetch par défaut de Next actif. Ajouter `prefetch` explicite là où c'est pertinent (cartes feed vers `/post` et `/work`).
**Fichiers :** `src/app/feed/loading.tsx`, `src/app/u/[username]/loading.tsx`, `src/app/search/loading.tsx`, `src/app/work/[id]/loading.tsx`, `src/app/bibliotheque/loading.tsx`, `src/app/communautes/loading.tsx`, `src/components/FeedCard.tsx`, `src/components/AppShell.tsx`, `src/app/globals.css` (utilitaire si besoin).

---

## Self-Review (couverture demande)

| Demande utilisateur | Tâche |
|---|---|
| Clic vus/lus → liste films vus / livres lus | B1 |
| Clic abonnés/abonnements → liste utilisateurs | B2 |
| Temps de visionnage invisible sur mon profil | A2 |
| Bouton « Enregistrer » → « Valider », plus visible | C1 |
| App plus réactive/dynamique | C2 |
| Fiche œuvre : « aucun avis » alors que le mien existe | A1 |

Toutes les demandes sont couvertes. Ordre : A (bugs) → B (stats) → C (UX). Chaque tâche est indépendamment testable et livrable.
