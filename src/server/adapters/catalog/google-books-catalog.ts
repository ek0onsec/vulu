import type { WorkSummary, WorkDetails, Genre, Person } from "@/server/ports/catalog";
import type { EpisodeSummary } from "@/server/domain/entities";

export interface GoogleBooksConfig { baseUrl: string; apiKey?: string; coversBaseUrl?: string }

interface Volume {
  id: string;
  volumeInfo?: {
    title?: string;
    authors?: string[];
    publishedDate?: string;
    description?: string;
    categories?: string[];
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
    pageCount?: number;
    industryIdentifiers?: { type: string; identifier: string }[];
  };
}

interface SecondaryBooks {
  lookupIsbn(isbn: string): Promise<{ title: string; authors: string[]; coverUrl: string | null } | null>;
  coverByIsbn(isbn: string): Promise<string | null>;
}

function isbnOf(info: Volume["volumeInfo"]): string | null {
  const ids = info?.industryIdentifiers ?? [];
  return ids.find((i) => i.type === "ISBN_13")?.identifier
    ?? ids.find((i) => i.type === "ISBN_10")?.identifier
    ?? null;
}

/** Liste curée de genres littéraires (Google Books n'expose pas de référentiel propre). */
const LITERARY_GENRES = [
  "Roman", "Science-fiction", "Fantasy", "Thriller", "Policier", "Romance",
  "Biographie", "Histoire", "Essai", "Poésie", "Bande dessinée", "Jeunesse",
  "Horreur", "Aventure", "Philosophie", "Développement personnel",
];

function yearOf(d?: string): number | null { return d ? Number(d.slice(0, 4)) || null : null; }

/** Identifiant numérique stable dérivé d'un nom (les auteurs Google Books n'ont pas d'id). */
function authorId(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function cover(info: Volume["volumeInfo"]): string | null {
  const raw = info?.imageLinks?.thumbnail ?? info?.imageLinks?.smallThumbnail;
  if (!raw) return null;
  // Miniatures Google Books : forcer https, retirer l'effet page-curl (dégrade le rendu)
  // et demander un zoom lisible plutôt que la vignette minuscule par défaut (zoom=1).
  return raw
    .replace(/^http:/, "https:")
    .replace("&edge=curl", "")
    .replace(/([?&]zoom=)\d+/, "$12");
}

export class GoogleBooksCatalog {
  constructor(private cfg: GoogleBooksConfig, private fetchImpl: typeof fetch = fetch, private secondary?: SecondaryBooks) {}

  private async get<T>(path: string, params: Record<string, string>): Promise<T> {
    const url = new URL(this.cfg.baseUrl + path);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    if (this.cfg.apiKey) url.searchParams.set("key", this.cfg.apiKey);
    const res = await this.fetchImpl(url.toString());
    if (!res.ok) throw new Error(`Google Books ${res.status}`);
    return res.json() as Promise<T>;
  }

  /**
   * Couverture de repli Open Library construite directement depuis l'ISBN — sans appel HTTP
   * (les résultats Google contiennent déjà l'ISBN). Garde la recherche fluide tout en comblant
   * les livres sans miniature Google. Retourne null si aucune base couvertures n'est configurée
   * ou si le volume n'a pas d'ISBN.
   */
  private olCoverByIsbn(info: Volume["volumeInfo"]): string | null {
    if (!this.cfg.coversBaseUrl) return null;
    const isbn = isbnOf(info);
    // default=false : renvoie 404 (donc tuile neutre) quand OL n'a pas la couverture,
    // au lieu du placeholder gris « Cover not available ».
    return isbn ? `${this.cfg.coversBaseUrl}/b/isbn/${isbn}-M.jpg?default=false` : null;
  }

  private toSummary(v: Volume): WorkSummary {
    const info = v.volumeInfo ?? {};
    return {
      source: "googlebooks",
      externalId: v.id,
      type: "book",
      title: info.title ?? "Sans titre",
      year: yearOf(info.publishedDate),
      posterUrl: cover(info) ?? this.olCoverByIsbn(info),
    };
  }

  async searchWorks(query: string): Promise<WorkSummary[]> {
    const data = await this.get<{ items?: Volume[] }>("/volumes", { q: query, maxResults: "20", printType: "books", langRestrict: "fr" });
    return (data.items ?? []).map((v) => this.toSummary(v));
  }

  async findByIsbn(isbn: string): Promise<WorkSummary | null> {
    const data = await this.get<{ items?: Volume[] }>("/volumes", { q: `isbn:${isbn}`, maxResults: "1" });
    const v = data.items?.[0];
    if (v) return this.toSummary(v);
    if (!this.secondary) return null;
    let ol: { title: string; authors: string[]; coverUrl: string | null } | null = null;
    try { ol = await this.secondary.lookupIsbn(isbn); } catch { ol = null; }
    if (!ol) return null;
    const byTitle = await this.searchWorks(ol.title);
    const match = byTitle[0];
    if (!match) return null;
    return match.posterUrl ? match : { ...match, posterUrl: ol.coverUrl };
  }

  async getPersonCredits(): Promise<WorkSummary[]> { return []; }

  async getSeasonEpisodes(): Promise<EpisodeSummary[]> { return []; }

  async getWork(externalId: string): Promise<WorkDetails | null> {
    const v = await this.get<Volume>(`/volumes/${externalId}`, {});
    if (!v?.id) return null;
    const info = v.volumeInfo ?? {};
    const details: WorkDetails = {
      source: "googlebooks",
      externalId: v.id,
      type: "book",
      title: info.title ?? "Sans titre",
      year: yearOf(info.publishedDate),
      posterUrl: cover(info),
      backdropUrl: null,
      overview: info.description ?? null,
      genres: info.categories ?? [],
      people: (info.authors ?? []).map((name) => ({ tmdbId: authorId(name), name, role: "author" as const })),
      externalRating: null,
      watchProviders: [],
      episodeCounts: null,
      pageCount: typeof info.pageCount === "number" && info.pageCount > 0 ? info.pageCount : null,
    };
    if (details.posterUrl === null && this.secondary) {
      const isbn = isbnOf(info);
      if (isbn) {
        try { const url = await this.secondary.coverByIsbn(isbn); if (url) details.posterUrl = url; } catch { /* repli silencieux */ }
      }
    }
    return details;
  }

  async listGenres(): Promise<Genre[]> {
    return LITERARY_GENRES.map((name, i) => ({ id: 10_000 + i, name }));
  }

  async searchPeople(query: string): Promise<Person[]> {
    const data = await this.get<{ items?: Volume[] }>("/volumes", { q: `inauthor:${query}`, maxResults: "20", printType: "books" });
    const seen = new Set<string>();
    const people: Person[] = [];
    for (const v of data.items ?? []) {
      for (const name of v.volumeInfo?.authors ?? []) {
        if (seen.has(name)) continue;
        seen.add(name);
        people.push({ tmdbId: authorId(name), name, role: "author", profileUrl: null });
      }
    }
    return people.slice(0, 10);
  }
}
