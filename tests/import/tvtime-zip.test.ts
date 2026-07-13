import { describe, it, expect } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { parseZip, buildPreview, extractCsvFiles } from "@/server/import/tvtime-zip";

const followed = "active,diffusion,notification_type,notification_offset,user_id,tv_show_id,created_at,tv_show_name,updated_at,folder_id,archived\n1,original,2,1440,7,73762,2016-04-30 20:18:17,Grey's Anatomy,2017-05-21 20:32:42,,0\n1,original,2,1440,7,80000,2020-01-01 10:00:00,To Watch,2020-01-01 10:00:00,,0";
const trackingV2 = "ep_id,ep_no,s_no,runtime,user_id,s_id,gsi,created_at,key,series_follow_count,total_series_runtime,movie_watch_count,total_movies_runtime,updated_at,ep_watch_count,is_archived,uuid,is_followed,most_recent_ep_watched,is_for_later,followed_at,is_unitary,rewatch_count,bulk_type,is_special,movie_name,series_name,season_number,episode_number\n1,1,1,40,7,73762,k,2018-01-02 20:00:00,watch-episode-1,,,,,,,,,,,,,,,,,,Grey,1,1";
const trackingV1 = "created_at,watch_count,type-uuid-n,user_id,series_id,type,updated_at,uuid,watches,series_uuid,runtime,entity_type,watch_date,episode_number,episode_id,season_number,alpha_range_key,release_date,release_date_range_key,rewatch_count,total_series_runtime,total_movies_runtime,watch_date_range_key,watched_episode_range_key,country,unitarian,bulk_type,movie_name,series_name\n2025-05-10 21:50:59,1,x,7,,movie,2025-05-10 21:50:59,u,,,7380,movie,,,,,,2014-11-19 00:00:00,,1,,,,,,,,The Matrix,";

function makeZip(withFolder = false): Uint8Array {
  const p = withFolder ? "gdpr-data/" : "";
  return zipSync({
    [`${p}followed_tv_show.csv`]: strToU8(followed),
    [`${p}tracking-prod-records-v2.csv`]: strToU8(trackingV2),
    [`${p}tracking-prod-records.csv`]: strToU8(trackingV1),
  });
}

describe("tvtime-zip", () => {
  it("extrait les CSV même sous un dossier racine", () => {
    const files = extractCsvFiles(makeZip(true));
    expect(files.followedShows).toContain("Grey's Anatomy");
  });
  it("buildPreview compte séries, à voir, épisodes, films", () => {
    const preview = buildPreview(parseZip(makeZip()));
    expect(preview.seriesTotal).toBe(2);
    expect(preview.seriesToWatch).toBe(1);
    expect(preview.episodesTotal).toBe(1);
    expect(preview.moviesTotal).toBe(1);
    expect(preview.movieNames).toContain("The Matrix");
  });
  it("échoue si un CSV attendu manque", () => {
    const bad = zipSync({ "autre.csv": strToU8("x") });
    expect(() => extractCsvFiles(bad)).toThrow();
  });
  it("rejette un CSV décompressé plus gros que le plafond (anti zip-bomb)", () => {
    // followed_tv_show.csv fait ~200 octets → un plafond de 50 octets doit le refuser.
    expect(() => extractCsvFiles(makeZip(), 50)).toThrow(/trop volumineux/);
  });
});
