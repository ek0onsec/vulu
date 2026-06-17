import type { CatalogProvider, WorkSummary, WorkDetails, Genre, Person } from "@/server/ports/catalog";

export class FakeCatalog implements CatalogProvider {
  works: Record<string, WorkDetails> = {
    "603": {
      externalId: "603", type: "movie", title: "The Matrix", year: 1999,
      posterUrl: "p.jpg", backdropUrl: "b.jpg", overview: "Neo…",
      genres: ["Science-fiction"], people: [{ tmdbId: 6384, name: "Keanu Reeves", role: "actor" }],
    },
  };
  async searchWorks(): Promise<WorkSummary[]> { return Object.values(this.works); }
  async getWork(externalId: string): Promise<WorkDetails | null> { return this.works[externalId] ?? null; }
  async listGenres(): Promise<Genre[]> { return [{ id: 878, name: "Science-fiction" }, { id: 18, name: "Drame" }, { id: 35, name: "Comédie" }]; }
  async searchPeople(): Promise<Person[]> { return [{ tmdbId: 1, name: "Denis Villeneuve", role: "director", profileUrl: null }]; }
}
