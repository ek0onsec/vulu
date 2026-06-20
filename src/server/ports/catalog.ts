import type { Domain, PersonRole, WorkSource, WorkType } from "@/server/domain/entities";

export interface WorkSummary {
  source: WorkSource;
  externalId: string;
  type: WorkType;
  title: string;
  year: number | null;
  posterUrl: string | null;
}
export interface WorkDetails extends WorkSummary {
  backdropUrl: string | null;
  overview: string | null;
  genres: string[];
  people: { tmdbId: number; name: string; role: PersonRole }[];
  externalRating: number | null;
  watchProviders: { name: string; logoUrl: string | null }[];
  episodeCounts?: number[] | null;  // tv uniquement
  pageCount?: number | null;        // livre uniquement
}
export interface Genre { id: number; name: string; }
export interface Person { tmdbId: number; name: string; role: PersonRole; profileUrl: string | null; }

export interface CatalogProvider {
  searchWorks(query: string, domain: Domain): Promise<WorkSummary[]>;
  getWork(externalId: string, type: WorkType): Promise<WorkDetails | null>;
  listGenres(domain: Domain): Promise<Genre[]>;
  searchPeople(query: string, domain: Domain): Promise<Person[]>;
  getPersonCredits(personId: string): Promise<WorkSummary[]>;
}
