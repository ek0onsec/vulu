import type { WorkSummary, WorkDetails, Genre, Person } from "@/server/ports/catalog";
import type { WorkType } from "@/server/domain/entities";

export interface TmdbConfig { apiKey: string; baseUrl: string; imageBase: string; }

interface TmdbSearchItem { media_type?: string; id: number; title?: string; name?: string;
  release_date?: string; first_air_date?: string; poster_path?: string | null; }
interface TmdbDetails { id: number; title?: string; name?: string; release_date?: string; first_air_date?: string;
  poster_path?: string | null; backdrop_path?: string | null; overview?: string;
  genres?: { id: number; name: string }[];
  credits?: { cast?: { id: number; name: string }[]; crew?: { id: number; name: string; job: string }[] }; }

function yearOf(d?: string): number | null { return d ? Number(d.slice(0, 4)) || null : null; }

export class TmdbCatalog {
  constructor(private cfg: TmdbConfig, private fetchImpl: typeof fetch = fetch) {}

  private img(path: string | null | undefined, size: string): string | null {
    return path ? `${this.cfg.imageBase}/${size}${path}` : null;
  }
  private async get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(this.cfg.baseUrl + path);
    url.searchParams.set("language", "fr-FR");
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    // Clé v4 (jeton JWT « eyJ… ») → Bearer ; sinon clé v3 → paramètre api_key.
    const headers: Record<string, string> = {};
    if (this.cfg.apiKey.startsWith("eyJ")) headers.Authorization = `Bearer ${this.cfg.apiKey}`;
    else url.searchParams.set("api_key", this.cfg.apiKey);
    const res = await this.fetchImpl(url.toString(), { headers });
    if (!res.ok) throw new Error(`TMDB ${res.status}`);
    return res.json() as Promise<T>;
  }

  async searchWorks(query: string): Promise<WorkSummary[]> {
    const data = await this.get<{ results: TmdbSearchItem[] }>("/search/multi", { query });
    return data.results
      .filter((r) => r.media_type === "movie" || r.media_type === "tv")
      .map((r) => ({
        source: "tmdb" as const,
        externalId: String(r.id),
        type: (r.media_type === "tv" ? "tv" : "movie") as WorkType,
        title: r.title ?? r.name ?? "Sans titre",
        year: yearOf(r.release_date ?? r.first_air_date),
        posterUrl: this.img(r.poster_path, "w500"),
      }));
  }

  async getWork(externalId: string, type: WorkType): Promise<WorkDetails | null> {
    const d = await this.get<TmdbDetails>(`/${type}/${externalId}`, { append_to_response: "credits" });
    if (!d?.id) return null;
    const cast = (d.credits?.cast ?? []).slice(0, 10).map((c) => ({ tmdbId: c.id, name: c.name, role: "actor" as const }));
    const directors = (d.credits?.crew ?? []).filter((c) => c.job === "Director")
      .map((c) => ({ tmdbId: c.id, name: c.name, role: "director" as const }));
    return {
      source: "tmdb", externalId: String(d.id), type,
      title: d.title ?? d.name ?? "Sans titre",
      year: yearOf(d.release_date ?? d.first_air_date),
      posterUrl: this.img(d.poster_path, "w500"),
      backdropUrl: this.img(d.backdrop_path, "w1280"),
      overview: d.overview ?? null,
      genres: (d.genres ?? []).map((g) => g.name),
      people: [...directors, ...cast],
    };
  }

  async listGenres(): Promise<Genre[]> {
    const [movie, tv] = await Promise.all([
      this.get<{ genres: Genre[] }>("/genre/movie/list"),
      this.get<{ genres: Genre[] }>("/genre/tv/list"),
    ]);
    const map = new Map<number, Genre>();
    for (const g of [...movie.genres, ...tv.genres]) map.set(g.id, g);
    return [...map.values()];
  }

  async searchPeople(query: string): Promise<Person[]> {
    const data = await this.get<{ results: { id: number; name: string; known_for_department?: string; profile_path?: string | null }[] }>("/search/person", { query });
    return data.results.map((p) => ({
      tmdbId: p.id, name: p.name,
      role: (p.known_for_department === "Directing" ? "director" : "actor") as Person["role"],
      profileUrl: this.img(p.profile_path, "w185"),
    }));
  }
}
