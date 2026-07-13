import type { CatalogProvider, WorkSummary, WorkDetails, Genre, Person } from "@/server/ports/catalog";
import type { Domain, WorkType, EpisodeSummary } from "@/server/domain/entities";

export class FakeCatalog implements CatalogProvider {
  works: Record<string, WorkDetails> = {
    "603": {
      source: "tmdb", externalId: "603", type: "movie", title: "The Matrix", year: 1999,
      posterUrl: "p.jpg", backdropUrl: "b.jpg", overview: "Neo…",
      genres: ["Science-fiction"], people: [{ tmdbId: 6384, name: "Keanu Reeves", role: "actor" }],
      externalRating: 8.2, watchProviders: [{ name: "Netflix", logoUrl: "n.jpg" }], runtime: 136,
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
      episodeCounts: [7, 13], runtime: 47,
    },
    // Collision d'espaces d'ID TMDB : la série et le film partagent l'ID numérique 1402.
    "tv-1402": {
      source: "tmdb", externalId: "1402", type: "tv", title: "The Walking Dead", year: 2010,
      posterUrl: "twd.jpg", backdropUrl: "b.jpg", overview: "Rick Grimes…",
      genres: ["Horreur"], people: [{ tmdbId: 2, name: "Andrew Lincoln", role: "actor" }],
      externalRating: 8.1, watchProviders: [], episodeCounts: [6], runtime: 44,
    },
    "movie-1402": {
      source: "tmdb", externalId: "1402", type: "movie", title: "The Peaceful Warrior", year: 2006,
      posterUrl: "pw.jpg", backdropUrl: "b.jpg", overview: "Un tout autre film…",
      genres: ["Drame"], people: [{ tmdbId: 3, name: "Nick Nolte", role: "actor" }],
      externalRating: 7.2, watchProviders: [], runtime: 120,
    },
  };
  async searchWorks(_query: string, domain: Domain): Promise<WorkSummary[]> {
    return Object.values(this.works).filter((w) => (domain === "books" ? w.type === "book" : w.type !== "book"));
  }
  async getWork(externalId: string, type: WorkType): Promise<WorkDetails | null> {
    // Comme TMDB (/{type}/{id}), on résout par id ET type : les espaces d'ID film/série sont disjoints.
    return Object.values(this.works).find((w) => w.externalId === externalId && w.type === type)
      ?? this.works[externalId] ?? null;
  }
  seasonCalls = 0;
  async getSeasonEpisodes(externalId: string, season: number): Promise<EpisodeSummary[]> {
    this.seasonCalls++;
    if (externalId === "1396" && season === 1) {
      return [
        { number: 1, title: "Pilote", airDate: "2008-01-20", overview: "Walter…" },
        { number: 2, title: "Le Chat dans le sac", airDate: "2008-01-27", overview: "Suite…" },
      ];
    }
    return [];
  }
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
