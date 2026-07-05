# Épisodes — Incrément 2a : suivi par épisode + page série en onglets (perso)

Date : 2026-07-05
Statut : validé (design)

## Contexte

Suite de l'incrément 1 (catalogue & cache des épisodes,
`getSeasonEpisodes`). Objectif : permettre de **cocher (vu), noter, commenter et
dater chaque épisode** d'une série, via une **page série en onglets**
(Aperçu / Épisodes). Tout est **personnel** dans cet incrément ; le partage au feed
est l'incrément 2b.

État actuel :
- La note/l'avis sont **par œuvre** (`LibraryEntry.rating`/`text`).
- Le « vu » par épisode vit dans `LibraryEntry.progress.watchedEpisodes: number[][]`,
  édité par une **grille de cases à cocher dans `EntryEditor`** (ajoutée récemment).
- `getLibrary.inProgress`, `InProgressShelf`, `formatProgress` lisent
  `progress.watchedEpisodes` / `season` / `episode`.
- La page œuvre `src/app/work/[id]/page.tsx` est un composant serveur qui rend
  header + `EntryEditor` + `AddToListButton` + `WorkReviews`.

## Décisions validées

- **Source unique du « vu »** : l'onglet Épisodes. La grille de `EntryEditor` est
  **retirée**. La position « en cours » (`season`/`episode`) et
  `progress.watchedEpisodes` sont **recalculés depuis les épisodes vus**, pour ne
  rien casser en aval.
- **Par épisode** : `watched`, `watchedAt`, `rating` (0–5, pas de 0,1 comme les
  œuvres), `text`.
- **Date de visionnage** : auto (aujourd'hui) à la coche, **éditable** ; effacée à
  la décoche.
- **Personnel** (hors feed) dans 2a ; audiences/partage → 2b.
- **Pas de migration** des marques « vu » existantes (early stage) : l'onglet
  lit/écrit `EpisodeEntry` ; l'ancien `progress.watchedEpisodes` est supersédé et
  recalculé depuis les entrées d'épisode à partir de la première action.

## Conception

### 1. Modèle — `src/server/domain/entities.ts`

```ts
export interface EpisodeEntry {
  id: string;
  userId: string;
  workId: string;
  season: number;
  episode: number;
  watched: boolean;
  watchedAt: Date | null;
  rating: number | null;   // 0–5, pas de 0,1
  text: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

Port `EpisodeEntryRepository` (`src/server/ports/repositories.ts`) :

```ts
export interface EpisodeEntryRepository {
  upsert(entry: EpisodeEntry): Promise<void>;
  findOne(userId: string, workId: string, season: number, episode: number): Promise<EpisodeEntry | null>;
  listByUserAndWork(userId: string, workId: string): Promise<EpisodeEntry[]>;
}
```

Adaptateurs :
- **Mémoire** : `Map` par `id` + recherche linéaire pour `findOne`/`listByUserAndWork`.
- **Mongo** : collection `episode_entries`, `_id = entry.id`, `findOne` par
  `{ userId, workId, season, episode }`, `listByUserAndWork` par `{ userId, workId }`.
  Mapper `toEpisodeEntryDoc`/`fromEpisodeEntryDoc`.

Câblage : `Deps.episodeEntries` (mémoire + mongo dans le container).

### 2. Application — `src/server/application/episode-entry.ts`

Réutilise la dérivation de progression. **Exporter** `normalizeGrid` et
`derivePosition` depuis `src/server/application/library-entry.ts` (aujourd'hui
privées) pour les partager.

```ts
export async function updateEpisode(
  deps: Deps, userId: string, ref: Ref, season: number, episode: number,
  input: { watched?: boolean; watchedAt?: Date | null; rating?: number | null; text?: string | null },
): Promise<EpisodeEntry>
```

Logique :
1. Valider `season ≥ 1`, `episode ≥ 1` (entiers) ; `rating` null ou 0–5 pas 0,1.
2. `getOrImportWork(deps, ref)` → `work` ; garantir une `LibraryEntry`
   (`loadOrCreateEntry`).
3. `findOne` l'`EpisodeEntry` existante (ou en créer une neuve avec `ids.next()`).
4. Appliquer les champs fournis :
   - `watched` : si `true` et pas de `watchedAt` explicite et pas déjà daté →
     `watchedAt = clock.now()` ; si `watchedAt` fourni → l'utiliser ; si `false` →
     `watchedAt = null`.
   - `rating`, `text` : écrasés si fournis (undefined = inchangé).
   - `updatedAt = now`.
5. `upsert` l'`EpisodeEntry`.
6. **Recalculer la progression de la `LibraryEntry`** : lister les
   `EpisodeEntry` vus de l'œuvre, construire la grille `number[][]`
   (index = saison−1, épisodes vus triés), `normalizeGrid` bornée par
   `work.episodeCounts`, `derivePosition` → `season`/`episode`. Mettre à jour
   `LibraryEntry.progress = { season, episode, tome: null, page: null,
   watchedEpisodes: (grille non vide ? grille : null) }` ; si son statut était
   `planned`, le passer à `in_progress` ; `upsert`.
7. Retourner l'`EpisodeEntry`.

```ts
export async function getEpisodeEntries(deps: Deps, userId: string, workId: string): Promise<EpisodeEntry[]>
```
→ `deps.episodeEntries.listByUserAndWork(userId, workId)`.

### 3. API

- `GET /api/works/[id]/seasons/[season]` :
  - charge l'œuvre (`deps.works.findById(id)`), 404 si absente ou non `tv` ;
  - `episodes = getSeasonEpisodes(deps, { source, externalId, type }, season)` (incr. 1) ;
  - `entries = getEpisodeEntries(...)` filtrées sur `season` ;
  - renvoie `{ episodes, entries }` (entries sérialisées : `watchedAt`/dates en ISO).
- `PUT /api/works/[id]/episodes` : `requireUser` ; parse
  `{ season, episode, watched?, rating?, text?, watchedAt? }` (Zod, nouveau
  `episodeUpdateSchema`) ; charge l'œuvre pour le `ref` ; `updateEpisode(...)` ;
  renvoie `{ entry }`.

Sérialisation : suivre `src/lib/serialize.ts` (dates → ISO) comme les autres entités.

### 4. UI

**`src/app/work/[id]/page.tsx`** (serveur) : pour `work.type === "tv"`, envelopper
le bloc actuel (EntryEditor + AddToListButton + « Ta note » + WorkReviews) dans un
nouveau composant client `SeriesTabs` passé en `children` (onglet **Aperçu**), avec
l'onglet **Épisodes** rendu par `EpisodesTab`. Films/livres : layout inchangé.

**`src/components/SeriesTabs.tsx`** (client) : barre d'onglets Aperçu / Épisodes,
état local ; affiche `children` (Aperçu) ou `<EpisodesTab workId source externalId
episodeCounts />` (Épisodes).

**`src/components/EpisodesTab.tsx`** (client) :
- sections par saison depuis `episodeCounts` ; à l'ouverture d'une saison,
  `GET /api/works/[id]/seasons/[n]` → fusionne épisodes catalogue + entrées ;
- par épisode : `n° · titre · date`, synopsis dépliable, **coche vu** (déclenche
  PUT `watched`, date auto), **note étoiles** (réutilise `RatingStars` en mode
  saisie ou un input compact), **commentaire** (textarea, PUT au blur), **date
  éditable** (`<input type="date">`, PUT `watchedAt`) visible quand vu ;
- optimiste + `toast` en cas d'erreur, cohérent avec les composants existants.

**`src/components/EntryEditor.tsx`** : **retirer** le bloc grille TV
(`status === "in_progress" && workType === "tv"`) et les états/handlers
`watched`/`toggleEp`/`toggleSeason`. Dans `saveProgress`, pour `tv`, n'envoyer que
`{ ref }` (updateProgress garde le statut `in_progress` et préserve/dérive la
progression). Le correctif « Valider persiste En cours » reste valable (statut
`in_progress` → `saveProgress`).

### 5. Tests

- **Mémoire `EpisodeEntry`** (`tests/adapters/episode-entry.test.ts`) : upsert →
  findOne → listByUserAndWork ; findOne inexistant → null.
- **`updateEpisode`** (`tests/application/episode-entry.test.ts`) :
  - coche `watched` → `watchedAt` = maintenant, `LibraryEntry` passe `in_progress`,
    `progress.watchedEpisodes` contient l'épisode, `season`/`episode` dérivés ;
  - décoche → `watchedAt` null, grille recalculée (épisode retiré) ;
  - `watchedAt` fourni → respecté ;
  - `rating`/`text` persistés, autres champs inchangés (undefined = inchangé) ;
  - `season`/`episode` < 1 ou rating invalide → `ValidationError`.
- **`getEpisodeEntries`** : renvoie les entrées de l'utilisateur pour l'œuvre.

## Fichiers touchés

- `src/server/domain/entities.ts` — `EpisodeEntry`.
- `src/server/ports/repositories.ts` — `EpisodeEntryRepository`.
- `src/server/adapters/memory/index.ts` — `InMemoryEpisodeEntryRepository`.
- `src/server/adapters/mongo/repositories.ts` + `mappers.ts` — `MongoEpisodeEntryRepository`.
- `src/server/container.ts` — câblage `episodeEntries`.
- `src/server/application/library-entry.ts` — exporter `normalizeGrid`/`derivePosition`.
- `src/server/application/episode-entry.ts` — `updateEpisode`, `getEpisodeEntries`.
- `src/lib/zod-schemas.ts` — `episodeUpdateSchema`.
- `src/app/api/works/[id]/seasons/[season]/route.ts` — GET.
- `src/app/api/works/[id]/episodes/route.ts` — PUT.
- `src/app/work/[id]/page.tsx` — onglets pour tv.
- `src/components/SeriesTabs.tsx` — nouveau.
- `src/components/EpisodesTab.tsx` — nouveau.
- `src/components/EntryEditor.tsx` — retrait grille TV.
- `src/lib/serialize.ts` — sérialisation `EpisodeEntry` si besoin.
- Tests ci-dessus.

## Hors périmètre (→ incrément 2b)

Audiences par épisode (public/cercle/communautés), `activityAt`, apparition des
avis d'épisode dans le feed et la `FeedCard`.
