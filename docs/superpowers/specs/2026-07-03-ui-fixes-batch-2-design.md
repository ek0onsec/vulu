# Batch 2 — Corrections iOS/route/icônes + nav retour recherche + scan batch + date & temps de visionnage + teaser communauté

**Statut :** design validé (2026-07-03).

**Contexte :** deuxième lot après `2026-07-02-ui-fixes-batch.md`. Mélange de régressions/bugs (route `/`, icônes, responsive iPhone, liens sociaux) et de nouvelles features à impact domaine (date de complétion, temps de visionnage, teaser communauté vulu+).

**Architecture :** App Next.js 16 (App Router, Turbopack), hexagonale côté serveur (domain/application/ports/adapters). Corrections logiques via domaine/application avec tests vitest ; corrections UI/CSS vérifiées manuellement (desktop + iPhone réel/émulé).

## Décisions validées

1. **Temps de visionnage** : films + séries uniquement, durées réelles TMDB. Film terminé = sa durée ; série = nb d'épisodes vus × durée d'un épisode. Converti en jours/mois sur le profil.
2. **Date de complétion** : optionnelle, pré-remplie à aujourd'hui quand on marque « Vu/Lu », modifiable et videable.
3. **Ordre de livraison** : bugs d'abord (Phase A), puis nav/scan (Phase B), puis nouvelles données (Phase C).
4. **Teaser communauté (C3)** : grand fond « Créer une communauté avec vulu+ » visible pour les **non-vulu+** uniquement ; les vulu+ conservent le bouton « Créer ».

## Contraintes globales

- Aucune mention IA / Claude / superpowers dans le code, l'app ou les commits ; aucun co-auteur Claude.
- Ne jamais toucher au dossier `lechatonfat/`.
- Architecture hexagonale : toute dépendance externe derrière un port ; le domaine ne connaît aucun driver/SDK.
- Aucun secret en dur ; validation des entrées aux frontières ; typage strict, pas de `any`.
- Commits fréquents, un par tâche, directement sur `master`.
- Vérifier avant de conclure : `npx tsc --noEmit` propre + `npx vitest run` vert.

---

## Phase A — Bugs & régressions

### A1 — Route `/` « page inaccessible »
**Cause probable :** un service worker obsolète (v1) reste actif sur le device et intercepte `/` avec un cache de redirection. Le fix v2 (batch 1) ne s'applique qu'après activation.
**Approche :** durcir la stratégie et la mise à jour du SW — s'assurer que les navigations sont toujours réseau-first et qu'aucune réponse `redirected` n'est mise en cache ni servie ; bump de version ; `skipWaiting`/`clients.claim` déjà présents. Vérifier HTTP (`/`→307, `/login`→200). Repro réelle : désenregistrer l'ancien SW + vider le cache sur le device. Investigation via superpowers:systematic-debugging avant tout correctif supplémentaire.
**Fichiers :** `public/sw.js` (+ éventuellement `ServiceWorkerRegister`).

### A2 — Icônes tronquées à droite (cœur du like)
**Cause à confirmer :** `shrink-0` (batch 1) n'a pas suffi. Hypothèses : `overflow="visible"` sur le `<svg>` combiné à un conteneur qui rogne, ou dernier tracé proche du bord du viewBox. Investigation via superpowers:systematic-debugging (repro DevTools mobile).
**Fichiers :** `src/components/Icon.tsx` et/ou le conteneur du bouton like dans `FeedCard.tsx`.

### A3 — iPhone : overlay scan hors-écran / dézoom manuel
**Cause racine probable :** iOS Safari zoome automatiquement au focus d'un `<input>` dont la police est < 16px (le champ de recherche est en `text-sm`), et ne dézoome pas ; l'overlay scan `fixed inset-0` se retrouve décalé hors-champ.
**Approche :** `export const viewport` → ajouter `maximumScale: 1` (empêche le zoom au focus) ; overlay scan en `100dvh` (hauteur dynamique iOS) ; conserver les safe-area du batch 1.
**Fichiers :** `src/app/layout.tsx`, `src/components/BookScanner.tsx`, éventuellement `globals.css`.

### A4 — Bouton « Éditer le profil » trop gros en mobile
**Approche :** version compacte mobile — icône seule ou `text-xs` avec le libellé masqué sous `sm:` (`hidden sm:inline`), en gardant la cible tactile ≥ 44px.
**Fichiers :** `src/components/ProfileEditModal.tsx`, `src/app/u/[username]/page.tsx` (conteneur).

### A5 — Liens sociaux
**Approche :** Discord `https://discord.gg/vulu` → `https://discord.gg/sgnZmxxUnx`. Retirer les entrées Instagram et X. Mettre à jour le libellé de la section (« Discord, Instagram, X » → « Discord »).
**Fichiers :** `src/app/parametres/SettingsClient.tsx` (l. 28, 166-168). `BrandLogo` conservé (encore utilisé pour Discord).

---

## Phase B — Navigation & scan batch

### B1 — Retour vers la recherche filtrée
**Objectif :** après avoir noté/ajouté une œuvre depuis la recherche, « retour » revient à `/search?q=…&domain=…` avec le terme déjà filtré.
**Approche :** `SearchPanel` synchronise `q` et `domain` dans l'URL (`router.replace(`/search?q=…&domain=…`)` en debounce) et initialise son état depuis `searchParams`. Le navigateur « retour » depuis `/work/[id]` restaure alors l'URL filtrée, et `SearchPanel` relance la recherche depuis l'URL. Pas de nouvel endpoint.
**Fichiers :** `src/components/SearchPanel.tsx`, `src/app/search/SearchClient.tsx`/`page.tsx` (passer les `searchParams`).

### B2 — Scan de collection en batch
**Objectif :** ajouter plusieurs livres d'affilée à une collection sans quitter le scanner ni ouvrir la fiche entre deux.
**Approche :** `BookScanner` gagne une prop optionnelle `mode: "single" | "batch"` (défaut `single`, rétrocompatible). En `batch` :
- `onIsbn` ajoute le livre et **ne ferme pas** le scanner ;
- une animation confirme l'ajout (miniature de couverture qui se « range » dans une pile en bas + compteur « N ajoutés ») ;
- anti-doublon immédiat (ne pas re-déclencher sur le même code tant qu'il reste dans le champ) ;
- un bouton **« Terminer »** ferme et rafraîchit la collection.
Le parent (`ListDetailModal`) fournit `onIsbn` qui résout l'ISBN puis ajoute à la liste, et gère le rafraîchissement à la fermeture. La bibliothèque (watchlist) peut réutiliser le même mode batch.
**Fichiers :** `src/components/BookScanner.tsx`, `src/components/ListDetailModal.tsx`, `src/app/bibliotheque/LibraryClient.tsx`.

---

## Phase C — Nouvelles données

### C1 — Date de lecture/visionnage
**Objectif :** enregistrer quand l'utilisateur a vu/lu une œuvre.
**Modèle :** ajouter `completedAt: Date | null` à `LibraryEntry` (domaine), aux mappers Mongo (`mappers.ts`, stockage ISO/Date) et memory, au schéma zod des entrées, et à la route `/api/works/entry`. Rétrocompatibilité : champ absent → `null`.
**UI :** dans `EntryEditor`, un sélecteur de date (`<input type="date">`) apparaît quand `status === "done"`, pré-rempli à aujourd'hui à la première complétion, modifiable et videable. Envoyé dans le payload `rateOrReviewWork`/`setEntryStatus`.
**Application :** `rateOrReviewWork` et `setEntryStatus` acceptent et persistent `completedAt` ; par défaut, marquer « done » sans date fournie pose la date du jour (via `deps.clock.now()`), un `completedAt` explicite (y compris `null`) est respecté. Tests vitest.
**Fichiers :** `src/server/domain/entities.ts`, `src/server/application/library-entry.ts`, `src/server/adapters/mongo/mappers.ts`, `src/server/adapters/memory/index.ts`, `src/lib/zod-schemas.ts`, `src/app/api/works/entry/route.ts`, `src/components/EntryEditor.tsx`, tests.

### C2 — Temps de visionnage sur le profil
**Objectif :** afficher sur le profil le temps total de visionnage (films + séries) converti en heures → jours/mois.
**Modèle :** ajouter `runtime: number | null` à `Work` (minutes ; film = durée du film, série = durée d'un épisode). TMDB : `runtime` (film) et `episode_run_time?.[0]` (série). Mappers Mongo + memory. Rétrocompat : œuvres existantes `runtime = null` jusqu'au prochain rafraîchissement (`cachedAt`).
**Calcul (application, testable) :** nouvelle fonction `computeWatchTime(deps, userId): { minutes: number }` :
- films terminés (`status === "done"`, `type === "movie"`) : `+ runtime` ;
- séries : `+ (épisodes vus) × runtime`. Épisodes vus = tous les épisodes si `done`, sinon somme via `progress` (saison/épisode) pour `in_progress`. Détail : pour `done`, total = `sum(episodeCounts)` ; pour `in_progress`, épisodes cumulés jusqu'à (saison, épisode) courant.
- `runtime = null` → ignoré (0).
**Affichage :** helper `formatWatchDuration(minutes)` → « 3 j 4 h » / « 2 mois » (règles : < 24h en heures, ≥ 24h en jours, ≥ ~30j en mois+jours). Affiché sur le profil (`/u/[username]`), section stats.
**Fichiers :** `src/server/domain/entities.ts`, `src/server/adapters/catalog/tmdb-catalog.ts`, `src/server/adapters/mongo/mappers.ts`, `src/server/adapters/memory/index.ts`, `src/server/application/watch-time.ts` (nouveau), `src/lib/format-duration.ts` (nouveau), `src/app/u/[username]/page.tsx`, tests.

### C3 — Teaser communauté vulu+
**Objectif :** sur la page Communautés, pour les non-vulu+, un grand fond intégré « Créer une communauté avec vulu+ » indiquant clairement que c'est une feature vulu+, soigné et responsive (mobile).
**Approche :** bloc hero/empty-state distinctif (dégradé de marque, typo `font-display`, mention vulu+), cliquable vers `/plus`. Visible uniquement si `!plus`. Les vulu+ gardent le bouton « Créer » actuel. Design via frontend-design.
**Fichiers :** `src/app/communautes/CommunitiesClient.tsx`.

---

## Self-Review (couverture demande)

| Demande utilisateur | Tâche |
|---|---|
| Bouton éditer profil trop gros mobile | A4 |
| Scan iPhone sort de l'écran / dézoom manuel | A3 |
| Discord → discord.gg/sgnZmxxUnx | A5 |
| Retirer Instagram et Twitter/X | A5 |
| Route `/` page inaccessible | A1 |
| Icônes tronquées à droite (cœur) | A2 |
| Retour après notation → recherche filtrée | B1 |
| Scan collection rapide en batch + animation + Terminer | B2 |
| Date de lecture/visionnage à la saisie | C1 |
| Temps de visionnage (jours/mois) sur le profil | C2 |
| Onglet Communauté : fond « Créer une communauté avec vulu+ » | C3 |

Toutes les demandes sont couvertes. Chaque tâche est indépendamment testable et livrable.
