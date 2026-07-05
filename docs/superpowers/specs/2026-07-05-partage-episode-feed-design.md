# Épisodes — Incrément 2b-i : partage des avis d'épisode au feed

Date : 2026-07-05
Statut : validé (design)

## Contexte

Suite de 2a (suivi par épisode `EpisodeEntry`, page en onglets). Objectif :
rendre un avis d'épisode (note + commentaire) **partageable** et l'afficher dans le
**feed**, à côté des avis d'œuvre. Les interactions (like/commentaires) sont
l'incrément 2b-ii.

État actuel :
- Le feed est bâti sur `LibraryEntry` : `FeedItem { entry, author, work, likeCount,
  commentCount, likedByMe, communities }` ; `buildFeed` → `deps.entries.feed(...)`
  → `enrichEntries`. Visibilité par `audiences` (`public`/`circle`/`communityIds`)
  + `activityAt`.
- `EpisodeEntry` (2a) porte `watched/watchedAt/rating/text` mais **pas** d'audiences
  ni d'`activityAt`.
- `FeedCard` et les consommateurs (`FeedClient`, `getEntryItem`, `post/[id]`,
  `getWorkReviews`) supposent `item.entry` = `LibraryEntry`.

## Décisions validées

- **Correctif 2a intégré** : la note par épisode passe d'étoiles entières au
  **`RatingSlider` 0–5 par pas de 0,1** (comme la note globale). Le backend accepte
  déjà les décimales (`isValidRating`).
- **Partage via le PUT épisode existant** : un champ optionnel `audiences` sur le
  PUT déclenche le partage (pas de route dédiée).
- **Item épisode dans le feed sans interactions** en 2b-i ; il pointe vers
  `/work/{workId}` (le post détaillé + like/commentaires → 2b-ii).
- **`FeedItem` devient une union discriminée** par `kind`.

## Conception

### 1. Modèle — `src/server/domain/entities.ts`

`EpisodeEntry` gagne :

```ts
  audiences: EntryAudiences;
  activityAt: Date | null;
```

Rétro-compat (entrées 2a sans ces champs) :
- Mapper mongo `fromEpisodeEntryDoc` : `audiences = e.audiences ?? { public: false, circle: false, communityIds: [] }` ; `activityAt = e.activityAt ?? null`.
- `updateEpisode` (2a) : à la création d'une `EpisodeEntry`, initialiser
  `audiences: { public: false, circle: false, communityIds: [] }`, `activityAt: null`.

### 2. Application — `src/server/application/episode-entry.ts` + `feed.ts`

**Partage** — étendre `updateEpisode` : accepte `input.audiences?: EntryAudiences`.
Si fourni :
- exiger une note **ou** un commentaire sur l'épisode (sinon `ValidationError`
  « Ajoute une note ou un commentaire ») ;
- vérifier l'appartenance à chaque communauté ciblée (comme `rateOrReviewWork`) ;
- destination non vide → `activityAt = now` ; « gardé pour moi » (aucune
  destination) → `activityAt = null` (retrait du feed) ;
- persister `audiences` sur l'`EpisodeEntry`.

**Requête feed épisodes** — `EpisodeEntryRepository.feed(opts)` mirroir de
`LibraryEntryRepository.feed` (mêmes `opts` : scope, circleUserIds, followingUserIds,
viewerId, cursor `{ activityAt, id }`, limit ; filtre `activityAt != null` +
visibilité par audiences/scope). Adaptateurs mémoire + mongo. Pas de filtre par
domaine (les épisodes sont des séries → domaine `films`, cohérent avec `activeTabs`
« films » ; on garde simple : pas de filtre domaine en 2b-i).

**Fusion feed** — `buildFeed` :
1. récupère en parallèle `deps.entries.feed(...)` et `deps.episodeEntries.feed(...)`
   (chacun `limit` items, mêmes filtres de visibilité/scope/curseur) ;
2. transforme chaque source en `FeedItem` (voir union), fusionne, **trie par
   `activityAt` desc** (départage par id), applique `limit` ;
3. le curseur suivant = `activityAt`/id du dernier item retenu.

**Union `FeedItem`** (`feed.ts`) :

```ts
export interface WorkFeedItem {
  kind: "work";
  entry: LibraryEntry;
  author: AuthorLite;
  work: WorkLite;
  likeCount: number; commentCount: number; likedByMe: boolean;
  communities: { id: string; name: string }[];
}
export interface EpisodeFeedItem {
  kind: "episode";
  episodeEntry: EpisodeEntry;
  author: AuthorLite;
  work: WorkLite;
  season: number; episode: number; title: string | null;
  communities: { id: string; name: string }[];
}
export type FeedItem = WorkFeedItem | EpisodeFeedItem;
```

(`AuthorLite`/`WorkLite` = les `Pick` actuels, extraits en alias.) `enrichEntries`
existant produit des `WorkFeedItem` (`kind: "work"`). Nouvelle
`enrichEpisodeEntries` produit des `EpisodeFeedItem` : résout auteur, œuvre,
communautés, et le **titre de l'épisode** via `getSeasonEpisodes` (incr. 1,
caché) pour la saison concernée (best-effort ; `title = null` si indisponible).

`getEntryItem`, `getMyWorkReview`, `getWorkReviews` sont typés **`WorkFeedItem`**
(type spécifique, pas l'union) — ainsi leurs consommateurs (`post/[id]`,
`WorkReviews`) accèdent à `.entry` sans narrowing. Seuls `buildFeed` (retour
`FeedItem`), `FeedCard` et `FeedClient` manipulent l'union. `WorkFeedItem` étant
assignable à `FeedItem`, `FeedCard` accepte les deux.

### 3. API

`episodeUpdateSchema` (`src/lib/zod-schemas.ts`) gagne un champ optionnel
`audiences: z.object({ public: z.boolean(), circle: z.boolean(), communityIds: z.array(z.string()) }).optional()`.
Le PUT `/api/works/[id]/episodes` passe `audiences` à `updateEpisode`.

### 4. UI

- **`EpisodesTab`** :
  - note par épisode → **`RatingSlider`** (0–5, pas 0,1) au lieu des étoiles
    entières ; PUT `rating` au changement (débounce léger optionnel) ;
  - quand l'épisode a une note ou un commentaire, un bouton **« Partager »**
    révèle des chips **Public / Cercle / Communautés** (même pattern que
    `EntryEditor`, communautés via `/api/communities/mine`) ; la sélection envoie
    `audiences` via le PUT ; badge « ✓ partagé » quand `activityAt` non nul.
- **`FeedCard`** : brancher sur `item.kind`.
  - `kind: "work"` → rendu actuel inchangé (via `item.entry`).
  - `kind: "episode"` → badge contexte « Série · S{season}E{episode}{· titre} », la
    note (`RatingStars` de `episodeEntry.rating`) et le commentaire
    (`episodeEntry.text`) ; overlay/lien vers `/work/{work.id}` ; **pas** de like ni
    compteur commentaire (2b-ii).
- **`FeedClient`** : `key` = `item.kind === "episode" ? episodeEntry.id : entry.id`.

### 5. Tests

- `updateEpisode` avec `audiences` : pose `activityAt` + audiences ; exige note/texte ;
  refuse une communauté non-membre ; « gardé pour moi » → `activityAt` null.
- `episodeEntries.feed` (mémoire) : visibilité public / cercle / communautés ;
  ignore `activityAt = null`.
- `buildFeed` : fusionne œuvres + épisodes, trie par `activityAt` desc, respecte
  `limit`.

## Fichiers touchés

- `src/server/domain/entities.ts` — `EpisodeEntry.audiences`/`activityAt`.
- `src/server/ports/repositories.ts` — `EpisodeEntryRepository.feed`.
- `src/server/adapters/memory/index.ts` + `mongo/{mappers,repositories}.ts` — feed + défauts rétro-compat.
- `src/server/application/episode-entry.ts` — partage dans `updateEpisode`.
- `src/server/application/feed.ts` — union `FeedItem`, `enrichEpisodeEntries`, fusion `buildFeed`.
- `src/lib/zod-schemas.ts` — `audiences` sur `episodeUpdateSchema`.
- `src/app/api/works/[id]/episodes/route.ts` — passe `audiences`.
- `src/components/EpisodesTab.tsx` — slider + partage.
- `src/components/FeedCard.tsx` — branche `kind`.
- `src/app/feed/FeedClient.tsx` — `key` par union.
- Tests ci-dessus.

## Hors périmètre (→ incrément 2b-ii)

Like + commentaires sur les avis d'épisode (routes, visibilité, actions
`FeedCard`, compteurs), page `/post` dédiée à un avis d'épisode.
