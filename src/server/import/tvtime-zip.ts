import { unzipSync, strFromU8 } from "fflate";
import { ValidationError } from "@/server/domain/errors";
import { parseTvTimeExport, type TvTimeExport, type TvTimeCsvFiles } from "./tvtime-parser";

const NEEDED = {
  followedShows: "followed_tv_show.csv",
  trackingV2: "tracking-prod-records-v2.csv",
  trackingV1: "tracking-prod-records.csv",
} as const;

export function extractCsvFiles(zip: Uint8Array): TvTimeCsvFiles {
  const files = unzipSync(zip);
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
