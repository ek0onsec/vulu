import { unzipSync, strFromU8 } from "fflate";
import { ValidationError } from "@/server/domain/errors";
import { parseTvTimeExport, type TvTimeExport, type TvTimeCsvFiles } from "./tvtime-parser";

const NEEDED = {
  followedShows: "followed_tv_show.csv",
  trackingV2: "tracking-prod-records-v2.csv",
  trackingV1: "tracking-prod-records.csv",
} as const;

/** Plafond de la taille DÉCOMPRESSÉE par CSV (anti zip-bomb) — le plus gros CSV réel fait ~2 Mo. */
export const CSV_MAX_BYTES = 32 * 1024 * 1024;

export function extractCsvFiles(zip: Uint8Array, maxCsvBytes: number = CSV_MAX_BYTES): TvTimeCsvFiles {
  const wanted = new Set<string>(Object.values(NEEDED));
  // On ne décompresse QUE les 3 CSV attendus, et on refuse toute entrée dont la taille
  // décompressée annoncée dépasse le plafond (protection contre les archives piégées).
  const files = unzipSync(zip, {
    filter: (f) => {
      const base = f.name.split("/").pop() ?? f.name;
      if (!wanted.has(base)) return false;
      if (f.originalSize > maxCsvBytes) throw new ValidationError("Archive invalide : fichier trop volumineux");
      return true;
    },
  });
  const names = Object.keys(files);
  const pick = (needle: string): string => {
    const key = names.find((k) => k.endsWith(needle));
    if (!key) throw new ValidationError(`Fichier manquant dans l'archive : ${needle}`);
    return strFromU8(files[key]!);
  };
  return {
    followedShows: pick(NEEDED.followedShows),
    trackingV2: pick(NEEDED.trackingV2),
    trackingV1: pick(NEEDED.trackingV1),
  };
}

export function parseZip(zip: Uint8Array): TvTimeExport {
  return parseTvTimeExport(extractCsvFiles(zip));
}

export interface ImportPreview {
  seriesTotal: number;
  seriesToWatch: number;
  episodesTotal: number;
  moviesTotal: number;
  seriesNames: string[];
  movieNames: string[];
}

export function buildPreview(data: TvTimeExport): ImportPreview {
  return {
    seriesTotal: data.series.length,
    seriesToWatch: data.series.filter((s) => s.watched.length === 0).length,
    episodesTotal: data.series.reduce((n, s) => n + s.watched.length, 0),
    moviesTotal: data.movies.length,
    seriesNames: data.series.map((s) => s.name),
    movieNames: data.movies.map((m) => m.name),
  };
}
