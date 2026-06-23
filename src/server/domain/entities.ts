export type Domain = "films" | "books";
export type WorkType = "movie" | "tv" | "book";
export type WorkSource = "tmdb" | "googlebooks";
export type EntryStatus = "planned" | "in_progress" | "done";
export interface EntryAudiences {
  public: boolean;        // visible par tous dans « Pour vous »
  circle: boolean;        // visible par le cercle (onglet « Mon cercle »)
  communityIds: string[]; // fils de communautés ciblés (implique aussi « Pour vous »)
}

export interface EntryProgress {
  season: number | null;   // séries
  episode: number | null;  // séries
  tome: number | null;     // livres
  page: number | null;     // livres
}
export type ListVisibility = "public" | "private";
export type PersonRole = "actor" | "director" | "author";

export interface Tastes {
  filmGenreIds: number[];
  bookGenreIds?: number[];
  people: { tmdbId: number; name: string; role: PersonRole }[];
}

/** Vitrine : top all-time choisi par l'utilisateur (workIds internes, max 5 par catégorie). */
export interface Showcase {
  movie: string[];
  tv: string[];
  book: string[];
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
  showcase: Showcase;
  plus: boolean;
  staff: boolean;
  private: boolean;
  twoFactorEnabled: boolean;
  deactivatedAt: Date | null;
  notificationsSeenAt: Date | null;
  createdAt: Date;
}

export interface Follow {
  followerId: string;
  followeeId: string;
  createdAt: Date;
}

/** Demande de suivi en attente (comptes privés). */
export interface FollowRequest {
  id: string;
  requesterId: string;
  targetId: string;
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
  episodeCounts: number[] | null;  // tv : nb d'épisodes par saison ; total = somme
  pageCount: number | null;        // livre : pages totales
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
  audiences: EntryAudiences;
  progress: EntryProgress | null;  // null pour les films « en cours » (statut seul)
  activityAt: Date | null;         // date d'apparition/remontée dans le feed (null = absent du feed)
  createdAt: Date;
  updatedAt: Date;
}

/** Communauté (type X Communities), publique ou privée. */
export interface Community {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  bannerUrl: string | null;
  visibility: "public" | "private";
  ownerId: string;
  createdAt: Date;
}

export type CommunityRole = "owner" | "moderator" | "member";

export interface Membership {
  communityId: string;
  userId: string;
  pinned: boolean;       // épinglée comme onglet du feed
  role: CommunityRole;
  createdAt: Date;
}

export interface CommunityRequest {
  id: string;
  communityId: string;
  userId: string;
  kind: "request" | "invite"; // "request" = demandé par l'utilisateur ; "invite" = par un mod
  createdAt: Date;
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
