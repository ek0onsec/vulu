export type Domain = "films" | "books";
export type WorkType = "movie" | "tv";
export type EntryStatus = "planned" | "done";
export type Visibility = "circle" | "public";
export type ListVisibility = "public" | "private";
export type PersonRole = "actor" | "director";

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
  activeTabs: Domain[];
  tastes: Tastes;
  createdAt: Date;
}

export interface Follow {
  followerId: string;
  followeeId: string;
  createdAt: Date;
}

export interface Work {
  id: string;
  source: "tmdb";
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

export interface List {
  id: string;
  userId: string;
  name: string;
  domain: Domain;
  description: string | null;
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
