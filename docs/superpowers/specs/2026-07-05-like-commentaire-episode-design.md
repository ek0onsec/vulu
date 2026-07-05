# Épisodes — Incrément 2b-ii : like + commentaires sur les avis d'épisode

Date : 2026-07-05
Statut : validé (design)

## Contexte

Dernier incrément de la chaîne « épisodes ». En 2b-i, les avis d'épisode
apparaissent dans le feed mais **sans interactions**. Objectif : parité complète —
**like + commentaires** sur les avis d'épisode, comme les avis d'œuvre.

État actuel :
- Likes/commentaires sont clés par `entryId` (id d'une `LibraryEntry`). Les
  collections `likes`/`comments` stockent par id ; `LikeRepository.countByEntry(id)`,
  `likedEntryIds`, `CommentRepository.countByEntry`/`listByEntry` opèrent sur un id
  quelconque.
- `engagement.ts` : `loadVisible(deps, viewerId, entryId)` charge une `LibraryEntry`
  et vérifie la visibilité (`assertVisible` sur `userId`/`audiences`). Utilisé par
  `likeEntry`/`unlikeEntry`/`commentOnEntry`/`listComments`.
- Routes : `/api/entries/[id]/like`, `/api/entries/[id]/comments`.
- `EpisodeFeedItem` (2b-i) n'a pas de compteurs. `EpisodeFeedCard` pointe vers
  `/work/{id}` sans like/commentaire.
- `EpisodeEntry` (unique id) porte déjà `userId` et `audiences`.

## Décisions validées

- **Réutiliser** les collections/routes likes-commentaires, clés par id — un id
  d'épisode y transite comme un id d'œuvre.
- **Généraliser** la visibilité (`loadVisible`) pour accepter une `LibraryEntry`
  **ou** une `EpisodeEntry`.
- La carte épisode pointe vers **`/post/{episodeEntry.id}`** avec fil de commentaires.

## Conception

### 1. Repository — `EpisodeEntryRepository.findById`

Ajouter au port et aux adaptateurs :

```ts
findById(id: string): Promise<EpisodeEntry | null>;
```

- Mémoire : `this.byId.get(id) ?? null`.
- Mongo : `findOne({ _id: id })` → `fromEpisodeEntryDoc`.

### 2. Visibilité généralisée — `src/server/application/engagement.ts`

`assertVisible` opère déjà sur `{ userId, audiences }` (commun aux deux types).
Généraliser le chargement :

```ts
type Visible = { userId: string; audiences: EntryAudiences };

async function loadVisible(deps: Deps, viewerId: string, id: string): Promise<Visible> {
  const entry = await deps.entries.findById(id);
  if (entry) { await assertVisible(deps, viewerId, entry); return entry; }
  const ep = await deps.episodeEntries.findById(id);
  if (ep) { await assertVisible(deps, viewerId, ep); return ep; }
  throw new NotFoundError("Entrée introuvable");
}
```

`assertVisible` prend `Visible` (au lieu de `LibraryEntry`). `likeEntry`,
`commentOnEntry`, `listComments` restent inchangés (ils appellent `loadVisible`).
`unlikeEntry`/`deleteComment` ne touchent pas la cible → inchangés.

Note : une `EpisodeEntry` « gardée pour moi » (`activityAt` null / audiences vides)
n'est visible que de son auteur → `assertVisible` la refuse aux autres, ce qui
empêche like/commentaire sur un avis non partagé. Comportement voulu.

### 3. Compteurs sur l'item épisode — `feed.ts`

`EpisodeFeedItem` gagne :

```ts
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
```

`enrichEpisodeEntries` les calcule (comme `enrichEntries`) :
`likes.countByEntry(ee.id)`, `comments.countByEntry(ee.id)`, et `likedByMe` via
`likes.likedEntryIds(viewerId, entries.map((e) => e.id))` (le paramètre `viewerId`
n'est donc plus ignoré).

### 4. Page post généralisée

`getEntryItem` devient **`getPostItem(deps, viewerId, id): Promise<WorkFeedItem | EpisodeFeedItem>`** :
1. `entry = deps.entries.findById(id)` → si présent + visible → `enrichEntries` (work item) ;
2. sinon `ep = deps.episodeEntries.findById(id)` → si présent + visible →
   `enrichEpisodeEntries` (episode item) ;
3. sinon `NotFoundError`.

La visibilité de l'épisode réutilise la logique audiences existante
`isEntryVisibleTo` en la rendant générique sur `{ userId: string; audiences: EntryAudiences }`
(le viewer voit : le sien, public, cercle si l'auteur y est, ou communauté membre).

`getEntryItem` est **renommé `getPostItem`** (retour union). Ses 3 appelants sont
mis à jour :
- `src/app/api/entries/[id]/route.ts` : `getPostItem(...)` (renvoie `{ item }`, union).
- `src/app/post/[id]/page.tsx` : `item: WorkFeedItem | EpisodeFeedItem` ; `FeedCard`
  accepte l'union ; fil `<CommentThread entryId={id} me={user.username} />`.
- `tests/application/feed.test.ts` : le bloc `getEntryItem (visibilité)` passe à
  `getPostItem` ; l'item d'œuvre est narrow via `item.kind === "work"` si `.entry`
  est lu.

### 5. UI — `EpisodeFeedCard` (`FeedCard.tsx`)

Amener la carte épisode à parité avec la carte œuvre :
- bouton **like** avec état optimiste (`api.post`/`api.del` sur
  `/api/entries/${item.episodeEntry.id}/like`) ; compteur `likeCount` ;
- **compteur de commentaires** (`commentCount`) ;
- overlay/lien vers **`/post/${item.episodeEntry.id}`** (au lieu de `/work/{id}`).

Réutiliser le même agencement d'actions que `WorkFeedCard` (icônes `Icon`
cœur/commentaire déjà importées).

## Tests

- `InMemoryEpisodeEntryRepository.findById` : trouvé / null.
- `engagement` : `likeEntry`/`commentOnEntry`/`listComments` sur un id d'épisode
  **partagé** (public) réussissent ; sur un épisode **privé** d'un autre
  utilisateur → `ForbiddenError` ; `commentOnEntry` crée un commentaire listé par
  `listComments`.
- `enrichEpisodeEntries` : expose `likeCount`/`commentCount`/`likedByMe` corrects
  après un like.
- `getPostItem` : renvoie un `EpisodeFeedItem` pour un id d'épisode partagé, un
  `WorkFeedItem` pour un id d'œuvre, `NotFoundError` sinon.

## Fichiers touchés

- `src/server/ports/repositories.ts` — `EpisodeEntryRepository.findById`.
- `src/server/adapters/memory/index.ts` + `mongo/repositories.ts` — `findById`.
- `src/server/application/engagement.ts` — `loadVisible`/`assertVisible` généralisés.
- `src/server/application/feed.ts` — compteurs `EpisodeFeedItem`, `enrichEpisodeEntries`, `getPostItem`.
- `src/app/post/[id]/page.tsx` — `getPostItem` + union.
- `src/components/FeedCard.tsx` — like/commentaire/lien sur `EpisodeFeedCard`.
- Tests : `tests/adapters/episode-entry.test.ts`, `tests/application/engagement*.test.ts` (ou nouveau), `tests/application/feed.test.ts`.

## Hors périmètre

Notifications sur like/commentaire d'un avis d'épisode (si le système de
notifications existe pour les œuvres, l'étendre serait un incrément distinct).
