# vulu — Sous-projet 1 : domaine Livres (Google Books)

**Date :** 2026-06-18 · **Statut :** validé, implémentation directe.

## Objectif
Activer le domaine Livres de bout en bout (recherche, fiche, note/commentaire, feed, listes) via Google Books, sans toucher au cœur métier hexagonal.

## Modèle (extensions)
- `WorkType` : `'movie' | 'tv' | 'book'`.
- `Work.source` : `'tmdb' | 'googlebooks'`.
- `PersonRole` : `'actor' | 'director' | 'author'`.
- `get-work` : `domainOf('book') = 'books'`, sinon `'films'`.

## Catalogue (routage par domaine)
- Port `CatalogProvider` domaine-aware :
  - `searchWorks(query, domain)`, `getWork(externalId, type)`, `listGenres(domain)`, `searchPeople(query, domain)`.
- `GoogleBooksCatalog` : recherche volumes (`/volumes?q=`), détail (`/volumes/{id}`), genres = liste littéraire curée, people = auteurs.
- `CompositeCatalog` : route TMDB (films/tv) vs Google Books (book) selon domaine/type. `Deps.catalog` reste unique.
- Env : `GOOGLE_BOOKS_BASE_URL` (défaut `https://www.googleapis.com/books/v1`), `GOOGLE_BOOKS_API_KEY` (optionnel).

## API & validation
- `workRefSchema` : `type ∈ {movie,tv,book}`, `source ∈ {tmdb,googlebooks}`.
- `/api/catalog/search?q=&domain=` ; `/api/catalog/genres?domain=` ; `/api/catalog/people?q=&domain=`.
- `/works/import`, `/works/entry` : inchangés (le `ref` porte source/type).

## UI
- Recherche : sélecteur Films/Livres (selon onglets actifs), recherche le bon catalogue.
- Fiche : pour un livre → label « Auteur », badge « Livre », couverture en poster. Reste identique.
- Feed/profil/onglets : déjà domaine-aware ; livres visibles si onglet Livres actif.

## Tests
- `GoogleBooksCatalog` (fetch mocké : search/get/authors + mapping couverture).
- `CompositeCatalog` route correctement par domaine/type.
- `get-work` : `book → books`.
- `workRefSchema` accepte un livre.

## Hors scope
SP2 playlists mixtes + onglet Bibliothèque ; SP3 filtres par personne ; SP4 paramètres (goûts livres/auteurs).
