# Livres : API secondaire (Open Library) en repli ciblé

Date : 2026-07-05
Statut : validé (design)

## Contexte

Les livres viennent de `GoogleBooksCatalog` (`src/server/adapters/catalog/google-books-catalog.ts`).
Deux manques observés :
- **Couvertures absentes** : certains volumes Google n'ont pas d'`imageLinks` →
  `posterUrl` nul → l'UI affiche un placeholder « image not available ».
- **ISBN non reconnu au scan** : la recherche `isbn:{isbn}` chez Google renvoie
  parfois `null` pour des livres récents → le scan échoue.

Le composite route les livres vers Google Books ; l'import passe par
`getOrImportWork` → `catalog.getWork(externalId, "book")` (résultat mis en cache
Mongo). `WorkSource` = `"tmdb" | "googlebooks"`.

## Décisions validées

- **Open Library** comme source secondaire (gratuite, sans clé).
- **Repli ciblé uniquement** : (a) couverture manquante, (b) ISBN introuvable.
  Google Books reste la source principale ; **pas de nouveau `WorkSource`**.
- Repli couverture dans `getWork` → **mis en cache** (persisté une fois).
- Repli ISBN : Open Library résout l'ISBN → titre → **nouvelle recherche titre
  Google** pour garder `source="googlebooks"`.
- Tout appel Open Library est **résilient** (try/catch → comportement actuel).

## Conception

### 1. Adaptateur `OpenLibraryBooks` — `src/server/adapters/catalog/open-library.ts`

```ts
export interface OpenLibraryConfig { baseUrl: string }
export interface OpenLibraryBook { title: string; authors: string[]; coverUrl: string | null }

export class OpenLibraryBooks {
  constructor(private cfg: OpenLibraryConfig, private fetchImpl: typeof fetch = fetch) {}
  async lookupIsbn(isbn: string): Promise<OpenLibraryBook | null>
  async coverByIsbn(isbn: string): Promise<string | null>
}
```

- `lookupIsbn` : `GET {baseUrl}/api/books?bibkeys=ISBN:{isbn}&format=json&jscmd=data`.
  Réponse : objet clé `"ISBN:{isbn}"` → `{ title, authors: [{ name }], cover: { large|medium|small } }`.
  Mappe → `{ title, authors: authors.map(a => a.name), coverUrl: cover.large ?? cover.medium ?? cover.small ?? null }`.
  Absent / erreur HTTP → `null`.
- `coverByIsbn` : appelle `lookupIsbn`, renvoie `coverUrl`.
- Toute exception réseau → `null` (jamais de throw vers l'appelant).

### 2. `GoogleBooksCatalog` — repli injecté

Interface de dépendance secondaire (structurelle, pour testabilité) :

```ts
interface SecondaryBooks {
  lookupIsbn(isbn: string): Promise<{ title: string; authors: string[]; coverUrl: string | null } | null>;
  coverByIsbn(isbn: string): Promise<string | null>;
}
```

Le constructeur devient :
`constructor(cfg, fetchImpl = fetch, secondary?: SecondaryBooks)`.

Ajouts au type `Volume.volumeInfo` : `industryIdentifiers?: { type: string; identifier: string }[]`.
Helper `isbnOf(info)` : renvoie l'ISBN-13 sinon l'ISBN-10 sinon `null`.

- **`getWork`** : après avoir construit le `WorkDetails`, si `posterUrl === null`
  et `secondary` défini et `isbnOf(info)` non nul → `secondary.coverByIsbn(isbn)`
  (try/catch) ; si une URL revient, l'affecter à `posterUrl`.
- **`findByIsbn(isbn)`** : si le résultat Google est `null` et `secondary` défini :
  1. `ol = await secondary.lookupIsbn(isbn)` (try/catch) ; si `null` → renvoyer `null`.
  2. recherche Google par titre : `searchWorks(ol.title)` ; prendre le 1er résultat.
  3. si un volume Google est trouvé : le renvoyer, en complétant sa couverture par
     `ol.coverUrl` si le volume Google n'en a pas.
  4. sinon → `null`.

(La couverture de repli en recherche de liste — `searchWorks` — n'est **pas**
enrichie via Open Library, pour éviter N appels réseau par recherche ; l'enrichissement
a lieu à l'import via `getWork`, ce qui suffit puisque les œuvres sont mises en cache.)

### 3. Config & câblage

- `src/lib/env.ts` : ajouter `OPENLIBRARY_BASE_URL: z.url().default("https://openlibrary.org")`.
- `src/server/container.ts` : `new GoogleBooksCatalog({ baseUrl: env.GOOGLE_BOOKS_BASE_URL, apiKey: env.GOOGLE_BOOKS_API_KEY }, fetch, new OpenLibraryBooks({ baseUrl: env.OPENLIBRARY_BASE_URL }))`.

### 4. Tests

- `tests/adapters/open-library.test.ts` : `lookupIsbn` (fetch stubbé) → parse
  titre/auteurs/couverture ; réponse vide → `null` ; HTTP erreur → `null`.
- `tests/adapters/google-books-catalog.test.ts` (existant) :
  - `getWork` d'un volume **sans** `imageLinks` mais **avec** `industryIdentifiers`
    → `posterUrl` = couverture fournie par un `secondary` factice.
  - `findByIsbn` : `isbn:` Google vide → `secondary.lookupIsbn` renvoie un titre →
    la recherche titre Google (stub) renvoie un volume → résultat non nul avec la
    bonne couverture.
  - Sans `secondary` (constructeur à 2 args), comportement inchangé (couverture nulle,
    findByIsbn nul) — non-régression.

## Fichiers touchés

- `src/server/adapters/catalog/open-library.ts` — nouvel adaptateur.
- `src/server/adapters/catalog/google-books-catalog.ts` — `SecondaryBooks`, `isbnOf`, repli cover + ISBN.
- `src/lib/env.ts` — `OPENLIBRARY_BASE_URL`.
- `src/server/container.ts` — câblage du secondaire.
- `tests/adapters/open-library.test.ts` (nouveau) + `tests/adapters/google-books-catalog.test.ts`.

## Hors périmètre

Open Library comme source de recherche/fiche à part entière (nouveau `WorkSource`) ;
enrichissement des couvertures en liste de recherche ; backfill des couvertures
manquantes déjà en cache (elles se rempliront à la prochaine visite de la fiche).
