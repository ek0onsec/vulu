# Bibliothèque : section « En cours » pour mise à jour rapide

Date : 2026-07-05
Statut : validé (design)

## Contexte

La page Bibliothèque (`src/app/bibliotheque/LibraryClient.tsx`, données via
`getLibrary` → `/api/library`) affiche trois blocs : « Mes collections »,
« À voir / à lire » (entrées `planned`) et « Vus / lus » (entrées `done`).

Il **manque un accès aux œuvres `in_progress`** (séries et livres en cours de
visionnage/lecture). Aujourd'hui, pour mettre à jour son avancement, l'utilisateur
doit ouvrir la page de chaque œuvre. Le composant `InProgressShelf`
(`src/components/InProgressShelf.tsx`) fait déjà exactement ce qu'il faut —
carrousel horizontal de posters + progression + boutons `+1 épisode` /
`+1 page` + `+10` — mais il n'est utilisé que sur la page profil
(`src/app/u/[username]/page.tsx`, self only).

## Objectif

Ajouter une section « En cours » en haut de la Bibliothèque, réutilisant
`InProgressShelf`, pour un accès rapide et une mise à jour en un geste des séries
et livres en cours.

Non-objectif : refonte des autres sections ; nouveau composant d'affichage.

## Décisions validées

- **Placement** : section en haut du corps de la Bibliothèque, après les filtres
  et le sélecteur de personne, **avant « Mes collections »**.
- **Réutilisation** : `InProgressShelf` utilisé tel quel (il porte déjà son titre
  « En cours » et ses boutons de mise à jour).
- **Filtres** : la section respecte le filtre de type actif (Tout/Films/Séries/
  Livres) **et** le filtre par personne, comme les sections existantes.
- **Affichage conditionnel** : la section n'apparaît que s'il reste ≥ 1 item après
  filtrage (pas de section vide).
- **Films `in_progress`** inclus (rares ; s'affichent sans bouton de mise à jour,
  comportement actuel de `InProgressShelf` via `it.type !== "movie"`).

## Conception

### Données — `src/server/application/library.ts`

Nouveau type exporté :

```ts
export interface LibraryInProgress {
  entryId: string; workId: string; source: WorkSource; externalId: string;
  title: string; posterUrl: string | null; type: WorkType;
  episodeCounts: number[] | null; pageCount: number | null;
  progress: EntryProgress | null; peopleIds: number[];
}
```

`Library` gagne le champ :

```ts
export interface Library {
  playlists: LibraryPlaylist[]; watchlist: LibraryPoster[]; seen: LibraryPoster[];
  inProgress: LibraryInProgress[]; people: { id: number; name: string; role: PersonRole }[];
}
```

`getLibrary` :
- ajoute `deps.entries.listByUser(userId, { status: "in_progress" })` au
  `Promise.all` existant (à côté de `planned`/`done`/`lists`) ;
- mappe chaque entrée en résolvant son œuvre (`deps.works.findById(e.workId)`),
  filtre les œuvres nulles, et construit la forme `LibraryInProgress` :
  `{ entryId: e.id, workId: w.id, source: w.source, externalId: w.externalId,
  title: w.title, posterUrl: w.posterUrl, type: w.type,
  episodeCounts: w.episodeCounts, pageCount: w.pageCount, progress: e.progress,
  peopleIds: w.people.map((p) => p.tmdbId) }` ;
- retourne `inProgress` dans l'objet `Library`.

`WorkSource`, `WorkType`, `EntryProgress` sont importés depuis
`@/server/domain/entities` (les deux premiers y sont déjà importés dans ce fichier ;
ajouter `EntryProgress`).

La route `/api/library` reste inchangée (elle sérialise déjà l'objet `Library`
entier).

### Composant — `src/components/InProgressShelf.tsx`

L'interface `Item` gagne un champ :

```ts
peopleIds: number[];
```

Aucune autre modification (le champ n'est pas lu par le composant ; il sert au
filtrage côté page).

### Page profil — `src/app/u/[username]/page.tsx`

Le mapping qui construit `inProgress` (≈ lignes 52-57) ajoute une propriété pour
rester conforme au nouveau type `Item` :

```ts
peopleIds: w.people.map((p) => p.tmdbId),
```

### UI — `src/app/bibliotheque/LibraryClient.tsx`

- Importer `InProgressShelf`.
- `data` (type `Library`) porte désormais `data.inProgress`.
- Calculer la liste filtrée à côté de `watchlist`/`seen` :
  ```ts
  const inProgress = data.inProgress.filter((x) => match(x.type) && matchPerson(x.peopleIds));
  ```
- Rendre, **juste après le bloc sélecteur de personne et avant la section
  « Mes collections »** :
  ```tsx
  {inProgress.length > 0 && <InProgressShelf items={inProgress} />}
  ```
  `InProgressShelf` fournit déjà `<section className="mb-6">` + `<h2>En cours</h2>`.

Le squelette de chargement (`if (!data)`) reste inchangé ; `data.inProgress` est un
tableau (jamais nul quand `data` est défini). Le fallback d'erreur de `load`
(`setData({ playlists: [], watchlist: [], seen: [], people: [] })`) doit inclure
`inProgress: []`.

## Optimisation de chargement (fusionnée à ce travail)

`getLibrary` est aujourd'hui lent car il construit la liste des personnes via une
**boucle séquentielle** qui re-télécharge chaque œuvre une par une
(`for (const id of ownedWorkIds) { const w = await deps.works.findById(id); … }`),
alors que ces œuvres ont déjà été chargées par `posters()` (double fetch).

Correctif ciblé, appliqué en même temps que l'ajout de `inProgress` :
- Charger les entrées `planned` + `done` + `in_progress` d'abord.
- Dédupliquer l'ensemble des `workId` et charger chaque œuvre **une seule fois, en
  parallèle**, dans une `Map<string, Work>`.
- Construire `watchlist`, `seen`, `inProgress` et la liste des `people` à partir de
  cette map (plus aucun `await` dans une boucle, plus de double fetch).
- `playlists` reste inchangé (ses œuvres de couverture sont d'autres works, déjà
  chargés en parallèle via `Promise.all`).

Aucun changement de contrat de sortie : `watchlist`/`seen`/`people` gardent la même
forme et le même contenu (couverts par les tests existants).

## Tests

`tests/application/library.test.ts` — nouveau cas :
1. Créer/mettre une entrée en `in_progress` (via l'API application existante,
   p. ex. `updateProgress`) pour un utilisateur.
2. Appeler `getLibrary` et vérifier :
   - l'œuvre apparaît dans `library.inProgress` avec `entryId`, `source`,
     `externalId`, `type`, `progress` et `peopleIds` corrects ;
   - elle n'apparaît **ni** dans `watchlist` **ni** dans `seen`.

## Fichiers touchés

- `src/server/application/library.ts` — type `LibraryInProgress`, champ `inProgress`, `getLibrary`.
- `src/components/InProgressShelf.tsx` — champ `peopleIds` sur `Item`.
- `src/app/u/[username]/page.tsx` — `peopleIds` dans le mapping in-progress.
- `src/app/bibliotheque/LibraryClient.tsx` — rendu de la section + filtrage + fallback.
- `tests/application/library.test.ts` — cas `inProgress`.
