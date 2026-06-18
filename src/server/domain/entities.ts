export type Domain = "films" | "books";
export type WorkType = "movie" | "tv" | "book";
export type WorkSource = "tmdb" | "googlebooks";
export type EntryStatus = "planned" | "done";
export type Visibility = "circle" | "public";
export type ListVisibility = "public" | "private";
export type PersonRole = "actor" | "director" | "author";

export interface Tastes {
  filmGenreIds: number[];
  people: { tmdbId: number; name: string; role: PersonRole }[];
}

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  activeTabs: Domain[];
  tastes: Tastes;
  plus: boolean;
  staff: boolean;
  createdAt: Date;
}

export interface Follow {
  followerId: string;
  followeeId: string;
  createdAt: Date;
}

export interface Work {
  id: string;
  source: WorkSource;
  externalId: string;
  type: WorkType;
  domain: Domain;
  title: string;
  year: number | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  overview: string | null;
  genres: string[];
  people: { tmdbId: number; name: string; role: PersonRole }[];
  externalRating: number | null;
  watchProviders: { name: string; logoUrl: string | null }[];
  cachedAt: Date;
}

export interface LibraryEntry {
  id: string;
  userId: string;
  workId: string;
  domain: Domain;
  status: EntryStatus;
  rating: number | null;
  text: string | null;
  visibility: Visibility;
  createdAt: Date;
  updatedAt: Date;
}

export type ListKind = "films" | "books" | "mixed";

/** Collection : films, séries et/ou livres selon son type (mixed = tout). */
export interface List {
  id: string;
  userId: string;
  name: string;
  kind: ListKind;
  description: string | null;
  bannerUrl: string | null;
  visibility: ListVisibility;
  workIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Like {
  entryId: string;
  userId: string;
  createdAt: Date;
}

export interface Comment {
  id: string;
  entryId: string;
  userId: string;
  text: string;
  createdAt: Date;
}
