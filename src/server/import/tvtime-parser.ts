export interface TvTimeSeries {
  tvdbId: string;
  name: string;
  followedAt: Date | null;
  watched: { season: number; episode: number; watchedAt: Date }[];
}
export interface TvTimeMovie { name: string; year: number | null; watchedAt: Date; }
export interface TvTimeExport { series: TvTimeSeries[]; movies: TvTimeMovie[]; }
export interface TvTimeCsvFiles { followedShows: string; trackingV2: string; trackingV1: string; }

/** Parseur CSV (RFC 4180 simplifié) : guillemets doubles, virgules et retours ligne dans les champs, "" échappé. */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c === "\r") { /* ignoré */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const header = rows[0]!;
  return rows.slice(1)
    .filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ""))
    .map((r) => Object.fromEntries(header.map((h, idx) => [h, r[idx] ?? ""])));
}

/** "2018-01-01 20:00:00" → Date (heure locale). */
function parseDate(s: string): Date | null {
  const t = s.trim();
  if (!t) return null;
  const d = new Date(t.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
}
function toInt(s: string): number | null {
  const n = Number.parseInt(s, 10);
  return Number.isInteger(n) ? n : null;
}

export function parseTvTimeExport(files: TvTimeCsvFiles): TvTimeExport {
  const seriesById = new Map<string, TvTimeSeries>();
  const get = (tvdbId: string, name: string): TvTimeSeries => {
    let s = seriesById.get(tvdbId);
    if (!s) { s = { tvdbId, name, followedAt: null, watched: [] }; seriesById.set(tvdbId, s); }
    return s;
  };

  // Séries suivies (donne le nom + date de suivi + les « à voir »)
  for (const r of parseCsv(files.followedShows)) {
    const tvdbId = r.tv_show_id?.trim();
    if (!tvdbId) continue;
    const s = get(tvdbId, r.tv_show_name ?? "");
    s.followedAt = parseDate(r.created_at ?? "");
    if (r.tv_show_name) s.name = r.tv_show_name;
  }

  // Épisodes vus (tracking v2), dédupliqués par (saison, épisode), plus ancienne date
  const watchedKey = new Map<string, Map<string, { season: number; episode: number; watchedAt: Date }>>();
  for (const r of parseCsv(files.trackingV2)) {
    const tvdbId = r.s_id?.trim();
    const season = toInt(r.season_number ?? "");
    const episode = toInt(r.episode_number ?? "");
    const watchedAt = parseDate(r.created_at ?? "");
    if (!tvdbId || season === null || episode === null || !watchedAt) continue;
    get(tvdbId, r.series_name ?? "");
    let m = watchedKey.get(tvdbId);
    if (!m) { m = new Map(); watchedKey.set(tvdbId, m); }
    const k = `${season}-${episode}`;
    const prev = m.get(k);
    if (!prev || watchedAt < prev.watchedAt) m.set(k, { season, episode, watchedAt });
  }
  for (const [tvdbId, m] of watchedKey) {
    const s = seriesById.get(tvdbId)!;
    s.watched = [...m.values()].sort((a, b) => a.season - b.season || a.episode - b.episode);
  }

  // Films (tracking v1, entity_type=movie), dédupliqués par (nom, année), plus ancienne date
  const movieKey = new Map<string, TvTimeMovie>();
  for (const r of parseCsv(files.trackingV1)) {
    if ((r.entity_type ?? "").trim() !== "movie") continue;
    const name = (r.movie_name ?? "").trim();
    const watchedAt = parseDate(r.created_at ?? "");
    if (!name || !watchedAt) continue;
    const year = r.release_date ? toInt(r.release_date.slice(0, 4)) : null;
    const k = `${name.toLowerCase()}-${year ?? ""}`;
    const prev = movieKey.get(k);
    if (!prev || watchedAt < prev.watchedAt) movieKey.set(k, { name, year, watchedAt });
  }

  return { series: [...seriesById.values()], movies: [...movieKey.values()] };
}
