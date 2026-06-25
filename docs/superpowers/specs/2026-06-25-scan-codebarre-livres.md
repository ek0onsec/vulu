# Scan de code-barres pour ajouter des livres — Design

Date : 2026-06-25
Statut : validé (brainstorming) — prêt pour le plan d'implémentation

## Objectif

Permettre, en plus de la recherche texte, de **scanner le code-barres** au dos d'un livre (EAN-13 =
ISBN) avec la caméra pour ouvrir directement sa fiche et l'ajouter à une liste / sa bibliothèque.
Réservé aux **livres**.

## Flux

```
Caméra → décodage EAN-13 (ISBN) → GET /api/catalog/isbn?isbn=…
       → WorkSummary (ref Google Books) → POST /api/works/import (existant)
       → router.push(/work/{id})   ← réutilise open() d'un résultat de recherche
```

L'ajout à une liste / bibliothèque se fait ensuite sur la fiche `/work/{id}` via les boutons déjà
présents — aucune nouvelle UI d'ajout. Le scan ne fait que **résoudre un ISBN → fiche**.

## Architecture (hexagonale — réutilise l'existant)

### Port — `CatalogProvider.findByIsbn`

`src/server/ports/catalog.ts` : ajouter à l'interface `CatalogProvider`

```ts
findByIsbn(isbn: string): Promise<WorkSummary | null>;
```

`WorkSummary` existant = `{ source, externalId, type, title, year, posterUrl }` (sert de `ref`).

### Adaptateur — Google Books

`src/server/adapters/catalog/google-books-catalog.ts` : méthode `findByIsbn(isbn)` qui appelle
`get("/volumes", { q: "isbn:" + isbn, maxResults: "1" })`, prend le premier volume et renvoie
`toSummary(v)` ; `null` si aucun `items`.

`src/server/adapters/catalog/composite-catalog.ts` : déléguer aux livres

```ts
findByIsbn(isbn: string): Promise<WorkSummary | null> { return this.books.findByIsbn(isbn); }
```

### Application — `findBookByIsbn`

Nouveau `src/server/application/find-book-by-isbn.ts` :

```ts
export async function findBookByIsbn(deps: Deps, rawIsbn: string): Promise<WorkSummary | null> {
  const isbn = rawIsbn.replace(/[^0-9Xx]/g, "").toUpperCase();
  if (isbn.length !== 10 && isbn.length !== 13) return null; // pas un ISBN → aucun appel réseau
  return deps.catalog.findByIsbn(isbn);
}
```

Responsabilité : normaliser (retirer tirets/espaces), valider la longueur (10 ou 13), puis interroger
le catalogue. La validation au plus tôt évite un appel réseau pour un code non-ISBN.

### HTTP — route ISBN

Nouveau `src/app/api/catalog/isbn/route.ts` : `GET`, `requireUser`, lit `?isbn=…`, valide via zod
(`isbnSchema`), appelle `findBookByIsbn`, renvoie `{ result: WorkSummary | null }`.

`src/lib/zod-schemas.ts` : `isbnSchema = z.object({ isbn: z.string().min(10).max(20) })`
(la normalisation fine est faite dans l'application ; le schéma borne juste l'entrée).

## Scanner (client)

- Bibliothèque **`@zxing/browser`** (décodage caméra multi-navigateurs — iOS Safari n'a pas l'API
  native `BarcodeDetector`). **Import dynamique** : `await import("@zxing/browser")` à l'ouverture du
  scanner uniquement → code-splitté, hors bundle principal.
- Nouveau composant `src/components/BookScanner.tsx` (`"use client"`) : overlay plein écran, flux
  vidéo (`getUserMedia`), cadre de visée, lecture restreinte au format **EAN-13**. Au premier code
  valide (13 chiffres, préfixe `978`/`979`) → callback `onIsbn(isbn)` puis arrêt du flux.
- Props : `onIsbn(isbn: string): void`, `onClose(): void`. Le composant gère le cycle de vie de la
  caméra (démarrage à l'ouverture, `stop()` + libération des pistes à la fermeture/démontage).
- **Erreurs gérées** (message clair + bouton fermer) : permission refusée (`NotAllowedError`),
  pas de caméra (`NotFoundError`), autre échec d'accès. Repli proposé : « utilise la recherche ».

## Intégration UI

`src/components/SearchPanel.tsx` :
- Quand `domain === "books"`, afficher une **icône caméra** à droite du champ de recherche
  (bouton). Masquée pour Films/Séries.
- Tap → ouvre `BookScanner`. `onIsbn` :
  1. `GET /api/catalog/isbn?isbn=…` → `{ result }`.
  2. `result` non nul → réutilise la logique de `open(result)` (POST `/api/works/import` puis
     `router.push("/work/" + work.id)`). Fermer le scanner.
  3. `result` nul → toast « Aucun livre trouvé pour ce code-barres » ; le scanner reste ouvert pour
     réessayer.
- Catalogue indisponible / erreur réseau → toast d'erreur générique.

Icône : utiliser le glyphe SVG **existant** `<Icon name="camera" />` (`camera` est déjà dans
`IconName` de `src/components/Icon.tsx`) — jamais un emoji. Cohérent avec les autres icônes de l'app.

## Tests

- **Application** `tests/application/find-book-by-isbn.test.ts` (avec `FakeCatalog`) :
  - ISBN valide (avec tirets) → `WorkSummary` attendu ; normalisation des tirets vérifiée.
  - chaîne non-ISBN (longueur ≠ 10/13) → `null` **sans** appeler le catalogue.
  - ISBN inconnu → `null`.
  - Ajout de `findByIsbn(isbn)` au `FakeCatalog` (`tests/helpers/fake-catalog.ts`) : renvoie un livre
    connu pour un ISBN de test, `null` sinon.
- **Adaptateur** `tests/adapters/google-books-catalog.test.ts` (ou fichier existant) : `fetchImpl`
  stubé → payload `{ items: [volume] }` → `toSummary` attendu ; `{ items: [] }` / absent → `null`.
- **zod** `tests/lib/zod-schemas.test.ts` : `isbnSchema` accepte une chaîne 10–20, rejette trop court.
- **Scanner caméra** : API navigateur (`getUserMedia`, ZXing) → pas de test unitaire ; smoke manuel
  mobile (scan d'un vrai livre, permission refusée, code inconnu).

## Dépendance

- `@zxing/browser` (+ `@zxing/library` en transitif) : scanner de code-barres. Justifié (réimplémenter
  le décodage EAN-13 serait absurde), **chargé en lazy** via import dynamique pour ne pas alourdir le
  bundle principal.

## Hors périmètre

- Films/séries (pas de cas d'usage code-barres consommateur).
- Saisie manuelle d'ISBN (la recherche texte couvre déjà ce besoin).
- Scan par lot / ajout direct multi-listes depuis le scanner (le flux passe par la fiche).

## Fichiers

- **Modifiés** : `src/server/ports/catalog.ts`, `src/server/adapters/catalog/google-books-catalog.ts`,
  `src/server/adapters/catalog/composite-catalog.ts`, `src/lib/zod-schemas.ts`,
  `src/components/SearchPanel.tsx`, `tests/helpers/fake-catalog.ts`, `package.json`.
- **Créés** : `src/server/application/find-book-by-isbn.ts`, `src/app/api/catalog/isbn/route.ts`,
  `src/components/BookScanner.tsx`, tests associés.
