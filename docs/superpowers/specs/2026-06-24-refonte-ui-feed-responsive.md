# Refonte UI feed + navigation responsive — Design

Date : 2026-06-24
Statut : validé (brainstorming) — prêt pour le plan d'implémentation

## Objectif

Rapprocher l'expérience vulu des grandes apps sociales : feed lisible « façon Twitter »
(effet escalier), navigation mobile moderne (side menu, bottom nav, recherche flottante),
et un onglet « Suivis » qui montre vraiment l'activité des comptes suivis.

Hors périmètre (notés pour plus tard) : motifs d'arrière-plan par thème vulu+, Rétrospection/Wrapped.

## 1. Onglet « Suivis » = following only (backend + UI)

Le 2ᵉ onglet du feed passe de « Mon cercle » (cercle = follows mutuels) à **« Suivis »**, qui
affiche l'activité des comptes que le viewer **suit** (unidirectionnel).

Règle de visibilité d'une entrée d'un compte suivi `author` : visible si
`audiences.public || (audiences.circle && viewerCercle.has(author.id))`.
→ on voit toujours les posts publics des comptes suivis ; les posts « cercle » seulement si la
relation est mutuelle (le viewer est dans le cercle de l'auteur). Les posts communautaires-seuls
ne remontent pas dans « Suivis ».

Le scope `circle` est **remplacé** par `following` dans toute la chaîne (aucun test buildFeed
existant n'utilise `circle`) :

- **Port** `LibraryEntryRepository.feed` (`src/server/ports/repositories.ts`) :
  - `scope: "foryou" | "following"` (au lieu de `"foryou" | "circle"`)
  - ajout du champ `followingUserIds: string[]` aux opts (à côté de `circleUserIds`).
- **Adaptateur mémoire** (`src/server/adapters/memory/index.ts`) :
  ```ts
  const circle = new Set(opts.circleUserIds);
  const following = new Set(opts.followingUserIds);
  // …
  .filter((e) => opts.scope === "following"
    ? (following.has(e.userId) && (e.audiences.public || (e.audiences.circle && circle.has(e.userId))))
    : (e.audiences.public || e.audiences.communityIds.length > 0 || (e.audiences.circle && circle.has(e.userId))))
  ```
- **Adaptateur Mongo** (`src/server/adapters/mongo/repositories.ts`) :
  ```ts
  const visibility: Filter<M.WithIdEntry> = opts.scope === "following"
    ? { userId: { $in: opts.followingUserIds }, $or: [
        { "audiences.public": true },
        { "audiences.circle": true, userId: { $in: opts.circleUserIds } },
      ] }
    : { $or: [
        { "audiences.public": true },
        { "audiences.communityIds.0": { $exists: true } },
        { "audiences.circle": true, userId: { $in: opts.circleUserIds } },
      ] };
  ```
- **Application** `buildFeed` (`src/server/application/feed.ts`) :
  - signature `scope: "foryou" | "following"`.
  - calcule `following = await deps.follows.followeeIdsOf(viewerId)` et le passe en `followingUserIds`.
  - continue de passer `circleUserIds: [...circle]`.
- **Route** `/api/feed` : `const scope = sp.get("scope") === "following" ? "following" : "foryou";`.

## 2. Renommage & UI des onglets (`FeedClient.tsx`)

- Tabs : `{ id: "foryou", label: "Pour toi" }`, `{ id: "following", label: "Suivis" }`, puis communautés épinglées.
- État initial `tab = "foryou"`.
- Copie d'état vide : pour `following` → « Personne que tu suis n'a publié récemment. Suis plus de monde ! ».

## 3. Refonte `FeedCard` — effet escalier 3 niveaux

Structure en grille `[avatar | gouttière | contenu]` : avatar en colonne 1, le nom/@pseudo en
colonne 3 (décalé à droite de l'avatar), et le **contenu d'activité décalé encore plus à droite**
que le pseudo (gouttière vide marquée à gauche).

Implémentation : conteneur `flex gap-3`. Colonne avatar (`shrink-0`). Colonne droite `flex-1` qui
contient l'en-tête (nom/@pseudo/temps/verbe + badges à droite) **et**, en dessous, un bloc contenu
avec un retrait gauche supplémentaire (`pl-6` ou `ml-6`) pour l'escalier.

Ordre vertical du bloc contenu (validé) :
1. verbe (« a noté » / « veut voir »…) — déjà sous le pseudo dans l'en-tête.
2. texte de l'avis (`item.entry.text`), `line-clamp-3`.
3. titre + `année · type`.
4. **affiche** (média cliquable `/work/:id`), coins arrondis, un peu plus grande que l'actuel 74px
   (≈ format média : largeur ~50–60 % de la colonne, ratio 2/3).
5. note étoiles + `x,y/5` (si `rating !== null`).
6. badge progression (si `status === "in_progress"`).

Badges « Public/Cercle » et « via communauté » restent en haut à droite de l'en-tête.
Footer (like / comment) inchangé, aligné sous le contenu.

## 4. Navigation responsive (`AppShell.tsx`)

Desktop (`md+`) : inchangé (sidebar gauche + rail droite).

Mobile (`< md`) :
- **Bottom nav** : 4 entrées seulement — **Accueil** (`/feed`), **Communautés** (`/communautes`),
  **Bibliothèque** (`/bibliotheque`), **Notifications** (`/notifications`, badge non-lus). On retire
  Recherche / Profil / Paramètres / vulu+ de la barre du bas.
- **Header mobile sticky** : barre fine en haut avec, **à droite, l'avatar** du viewer (bouton).
  Au tap → ouverture du **side menu** glissant depuis la gauche.
- **Suppression mobile** : le bouton flottant `+` (lien `/search`) et le `FeedComposer` sont masqués
  (`hidden md:flex` / `md:block`). Desktop conserve les deux.

## 5. `SideMenu.tsx` (nouveau, mobile)

Panneau glissant depuis la gauche (translateX), avec backdrop semi-opaque cliquable pour fermer,
fermeture sur changement de route et sur `Échap`. Contenu :
- pdp (Avatar), nom affiché + badges, `@pseudo`.
- compteurs **abonnés / abonnements** (depuis `/api/me`, voir §7).
- liens : **Profil** (`/u/me`), **vulu+** (`/plus`), **Paramètres** (`/parametres`).
- `ThemeToggle`.
- **Déconnexion** (réutilise `logout()` de l'AppShell).

État `open`/`setOpen` géré dans `AppShell`. Le composant est purement présentationnel + callbacks.

## 6. `SearchIsland.tsx` + `SearchPanel.tsx` (nouveaux, mobile)

- **`SearchPanel`** : extraction du cœur réutilisable de `SearchClient` (champ + debounce +
  résultats œuvres/@membres + sélecteur de domaine). Props : `activeTabs: Domain[]`,
  `autoFocus?: boolean`. Réutilisé par la page `/search` (`SearchClient` le rend) **et** par
  l'overlay mobile. Aucune duplication de la logique de recherche.
- **`SearchIsland`** : pilule flottante **sticky**, superposée au feed, suit le scroll. Positionnée
  **sous les onglets** Pour toi/Suivis (offset top correspondant à la hauteur des onglets) pour ne
  pas les masquer. Au tap → **overlay plein écran** (backdrop + `SearchPanel autoFocus`), fermable
  (✕ / backdrop / Échap). Rendu uniquement `< md`.
- Intégration : `SearchIsland` rendu dans `FeedClient` (sous les onglets) plutôt que dans l'AppShell,
  pour connaître la position des onglets et n'apparaître que sur le feed.

## 7. `/api/me` enrichi

`GET /api/me` renvoie en plus : `activeTabs: Domain[]`, `followers: number`, `following: number`
(via `deps.follows.countFollowers/countFollowing`). Consommé par `SideMenu` (compteurs) et
`SearchIsland`/overlay (domaines). Met à jour l'interface `Me` de l'AppShell.

## 8. Tests

- **Application** `tests/application/feed.test.ts` : ajouter un cas scope `following` —
  un compte suivi public remonte ; un compte non suivi ne remonte pas ; un post « cercle » d'un
  suivi non-mutuel ne remonte pas, mais remonte s'il est mutuel.
- **Adaptateurs** `tests/adapters/memory.test.ts` (+ parité Mongo si pertinent) : `feed` scope
  `following` filtre bien par `followingUserIds` et la visibilité.
- **Types** : `npx tsc --noEmit` vert (le changement de signature `feed` se propage aux deux
  adaptateurs, à l'application et aux tests existants qui passent `scope: "foryou"` —
  ajouter `followingUserIds: []` à ces appels de test).
- Le reste (FeedCard, AppShell, SideMenu, SearchIsland) est présentationnel : pas de test unitaire,
  vérification par `tsc` + suite Vitest verte + smoke manuel responsive.

## Fichiers

- **Modifiés** : `src/server/ports/repositories.ts`, `src/server/adapters/memory/index.ts`,
  `src/server/adapters/mongo/repositories.ts`, `src/server/application/feed.ts`,
  `src/app/api/feed/route.ts`, `src/app/api/me/route.ts`, `src/app/feed/FeedClient.tsx`,
  `src/components/FeedCard.tsx`, `src/components/AppShell.tsx`, `src/app/search/SearchClient.tsx`,
  tests `feed.test.ts` / `memory.test.ts` / `mongo-repositories.test.ts`.
- **Créés** : `src/components/SideMenu.tsx`, `src/components/SearchIsland.tsx`,
  `src/components/SearchPanel.tsx`.
