import type { CatalogProvider, WorkSummary, WorkDetails, Genre, Person } from "@/server/ports/catalog";
import type { Domain, WorkType } from "@/server/domain/entities";
import type { TmdbCatalog } from "./tmdb-catalog";
import type { GoogleBooksCatalog } from "./google-books-catalog";

/** Route les requêtes catalogue vers TMDB (films/séries) ou Google Books (livres). */
export class CompositeCatalog implements CatalogProvider {
  constructor(private films: TmdbCatalog, private books: GoogleBooksCatalog) {}

  searchWorks(query: string, domain: Domain): Promise<WorkSummary[]> {
    return domain === "books" ? this.books.searchWorks(query) : this.films.searchWorks(query);
  }
  getWork(externalId: string, type: WorkType): Promise<WorkDetails | null> {
    return type === "book" ? this.books.getWork(externalId) : this.films.getWork(externalId, type);
  }
  listGenres(domain: Domain): Promise<Genre[]> {
    return domain === "books" ? this.books.listGenres() : this.films.listGenres();
  }
  searchPeople(query: string, domain: Domain): Promise<Person[]> {
    return domain === "books" ? this.books.searchPeople(query) : this.films.searchPeople(query);
  }
  getPersonCredits(personId: string): Promise<WorkSummary[]> {
    return this.films.getPersonCredits(personId);
  }
}
