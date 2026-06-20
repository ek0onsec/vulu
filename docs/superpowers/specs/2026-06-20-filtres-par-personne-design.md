# Exploration par personne (acteur / réalisateur / auteur) — Design

Date : 2026-06-20
Statut : approuvé (à implémenter)

## Objectif

Explorer le catalogue et sa bibliothèque par personne : cliquer un acteur, un
réalisateur ou un auteur ouvre une page listant ses œuvres ; filtrer sa bibliothèque
par personne. Couvre SP3 de la roadmap.

Décisions de cadrage (validées) :
- Surfaces : **page personne** + **filtre dans la bibliothèque**.
- Périmètre des œuvres d'une personne : **ma bibliothèque** + **découverte catalogue**.
- Noms cliquables : **fiche œuvre + favoris** (le feed n'affiche pas de noms → hors périmètre).

## 1. Identité d'une personne

Les `people` d'un `Work` portent `{ tmdbId: number, name: string, role: PersonRole }`.
- Pour TMDB (films/séries), `tmdbId` est le vrai id de personne TMDB.
- Pour les livres, `tmdbId` est un **hash stable du nom** (`authorId(name)` dans
  `google-books-catalog.ts`), donc **non réversible**.

Conséquence : une personne est identifiée par **source + id**, et le **nom doit être
transporté** (nécessaire pour interroger Google Books côté auteurs, et pour l'affichage).

- Route : `/personne/[id]` où `[id]` vaut `tmdb-<id>` ou `book-<id>`.
- Paramètres de requête : `?name=<nom>` (requis) et `?role=<role>` (libellé).
- Helper `personHref(p: { tmdbId, name, role }, workType: WorkType): string` centralise la
  construction du lien. `workType === "book"` → préfixe `book-`, sinon `tmdb-`.
- Helper `parsePersonId(id: string): { source: "tmdb" | "book", externalId: number } | null`
  décode le segment de route.

## 2. Page personne

Application `getPersonProfile(deps, userId, input: { source: "tmdb" | "book"; externalId: number; name: string }): Promise<PersonProfile>` où

```ts
interface PersonWork { workId: string; source: WorkSource; externalId: string; title: string; posterUrl: string | null; type: WorkType; status: EntryStatus; rating: number | null }
interface DiscoveryWork { source: WorkSource; externalId: string; title: string; posterUrl: string | null; type: WorkType }
interface PersonProfile { name: string; library: PersonWork[]; discovery: DiscoveryWork[] }
```

- **Bibliothèque** : `deps.entries.listByUser(userId, {})` (toutes les entrées), résolution
  des `Work`, filtre `work.people.some((p) => p.tmdbId === externalId)`. Chaque œuvre porte
  le statut + la note de l'entrée. Aucun appel API.
- **Découverte** (œuvres pas déjà en bibliothèque) :
  - `source === "tmdb"` → `catalog.getPersonCredits(String(externalId))`.
  - `source === "book"` → `catalog.searchWorks(name, "books")`, filtré aux résultats dont
    un auteur a `authorId(author) === externalId` (réutilise le même hash).
  - On retire les œuvres dont l'`externalId` figure déjà dans la bibliothèque, on plafonne à 20.

Port catalogue (`CatalogProvider`) : ajout de
`getPersonCredits(personId: string): Promise<WorkSummary[]>`.
- `TmdbCatalog` : `GET /person/{id}/combined_credits` → fusionne `cast` + `crew`,
  garde `media_type` `movie`/`tv`, déduplique par id, mappe en `WorkSummary`.
- `GoogleBooksCatalog` : renvoie `[]` (jamais appelé pour les livres).
- `CompositeCatalog` : délègue à l'adaptateur TMDB.

Route : `src/app/personne/[id]/page.tsx` (server) lit `params.id` + `searchParams.name`,
décode via `parsePersonId`, appelle `getPersonProfile`, rend un client
`PersonClient` (en-tête nom + rôle, grille « Dans ta bibliothèque », grille « À découvrir »
avec liens vers `/work/...` après import, c.-à-d. via le flux d'import existant).

## 3. Filtre dans la bibliothèque

`getLibrary` enrichi :
- Chaque `LibraryPoster` gagne `peopleIds: number[]` (les `tmdbId` des `people` de l'œuvre).
- `Library` expose `people: { id: number; name: string; role: PersonRole }[]` — liste
  **distincte** des personnes présentes dans la bibliothèque, triée par nom.

`LibraryClient` : ajout d'un **sélecteur de personne** (menu déroulant ou puces
recherchables) à côté du filtre type. Filtrage **client** : une œuvre passe si
`peopleIds.includes(selectedPersonId)`. Une entrée « Toutes les personnes » réinitialise.
Optionnel : un lien « voir la page » vers `/personne/...` pour la personne sélectionnée.

## 4. Noms cliquables

- **Fiche œuvre** `/work/[id]` : les puces créateurs (réalisateur/auteur) et casting
  deviennent des `<Link href={personHref(p, work.type)}>`.
- **Favoris** (`TasteSelector`, Paramètres → Centres d'intérêt) : les personnes favorites
  affichées deviennent des liens vers leur page. `TasteSelector` étant un éditeur, le lien
  s'ouvre dans un nouvel onglet pour ne pas perdre la sélection en cours.
- **Feed** : aucun nom affiché aujourd'hui → rien à câbler (hors périmètre).

## 5. Tests (TDD)

- `personHref` / `parsePersonId` : encodage/décodage tmdb vs book + nom.
- `getPersonProfile` : match bibliothèque par `tmdbId` (film, série, livre) ; exclusion de
  la découverte des œuvres déjà possédées ; branche tmdb (credits) vs book (search+hash).
- `TmdbCatalog.getPersonCredits` (fetch mocké) : cast+crew → `WorkSummary[]` dédupliqués,
  exclusion des `media_type` autres que movie/tv.
- `getLibrary` : `peopleIds` par poster + liste distincte triée.

## Hors périmètre (YAGNI)

- Pas de noms cliquables dans le feed (aucun nom rendu).
- Pas de page personne « globale » (bio, photo, filmographie complète hors de ton usage) :
  on se limite à tes œuvres + une découverte best-effort.
- Pas de nouvel index/colonne : le matching bibliothèque scanne les entrées de l'utilisateur
  (volumes faibles), pas de requête `works.byPerson` côté repo.
