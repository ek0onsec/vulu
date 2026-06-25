import type { CatalogProvider, WorkSummary, WorkDetails, Genre, Person } from "@/server/ports/catalog";
import type { Domain, WorkType } from "@/server/domain/entities";

export class FakeCatalog implements CatalogProvider {
  works: Record<string, WorkDetails> = {
    "603": {
      source: "tmdb", externalId: "603", type: "movie", title: "The Matrix", year: 1999,
      posterUrl: "p.jpg", backdropUrl: "b.jpg", overview: "Neo…",
      genres: ["Science-fiction"], people: [{ tmdbId: 6384, name: "Keanu Reeves", role: "actor" }],
      externalRating: 8.2, watchProviders: [{ name: "Netflix", logoUrl: "n.jpg" }],
    },
    "book-1": {
      source: "googlebooks", externalId: "book-1", type: "book", title: "Neuromancien", year: 1984,
      posterUrl: "c.jpg", backdropUrl: null, overview: "Cyberpunk fondateur.",
      genres: ["Science-fiction"], people: [{ tmdbId: 99, name: "William Gibson", role: "author" }],
      externalRating: null, watchProviders: [], pageCount: 271,
    },
    "1396": {
      source: "tmdb", externalId: "1396", type: "tv", title: "Breaking Bad", year: 2008,
      posterUrl: "p.jpg", backdropUrl: "b.jpg", overview: "Walter White…",
      genres: ["Drame"], people: [{ tmdbId: 1, name: "Bryan Cranston", role: "actor" }],
      externalRating: 8.9, watchProviders: [{ name: "Netflix", logoUrl: "n.jpg" }],
      episodeCounts: [7, 13],
    },
  };
  async searchWorks(_query: string, domain: Domain): Promise<WorkSummary[]> {
    return Object.values(this.works).filter((w) => (domain === "books" ? w.type === "book" : w.type !== "book"));
  }
  async getWork(externalId: string, _type: WorkType): Promise<WorkDetails | null> { return this.works[externalId] ?? null; }
  async findByIsbn(isbn: string): Promise<WorkSummary | null> {
    if (isbn !== "9780441569595") return null;
    const w = this.works["book-1"]!;
    return { source: w.source, externalId: w.externalId, type: w.type, title: w.title, year: w.year, posterUrl: w.posterUrl };
  }
  async getPersonCredits(personId: string): Promise<WorkSummary[]> {
    if (personId !== "6384") return [];
    return [this.works["603"], this.works["1396"]]
      .filter((w): w is WorkDetails => w !== undefined)
      .map((w) => ({ source: w.source, externalId: w.externalId, type: w.type, title: w.title, year: w.year, posterUrl: w.posterUrl }));
  }
  async listGenres(domain: Domain): Promise<Genre[]> {
    return domain === "books"
      ? [{ id: 10000, name: "Roman" }, { id: 10001, name: "Science-fiction" }, { id: 10002, name: "Essai" }]
      : [{ id: 878, name: "Science-fiction" }, { id: 18, name: "Drame" }, { id: 35, name: "Comédie" }];
  }
  async searchPeople(_query: string, domain: Domain): Promise<Person[]> {
    return domain === "books"
      ? [{ tmdbId: 99, name: "William Gibson", role: "author", profileUrl: null }]
      : [{ tmdbId: 1, name: "Denis Villeneuve", role: "director", profileUrl: null }];
  }
}
