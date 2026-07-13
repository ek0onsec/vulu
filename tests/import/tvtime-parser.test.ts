import { describe, it, expect } from "vitest";
import { parseTvTimeExport } from "@/server/import/tvtime-parser";

const followed = [
  "active,diffusion,notification_type,notification_offset,user_id,tv_show_id,created_at,tv_show_name,updated_at,folder_id,archived",
  "1,original,2,1440,7105043,73762,2016-04-30 20:18:17,Grey's Anatomy,2017-05-21 20:32:42,,0",
  "1,original,2,1440,7105043,80000,2020-01-01 10:00:00,To Watch Show,2020-01-01 10:00:00,,0",
].join("\n");

// series_name avec virgule entre guillemets + rewatch dédupliqué + ligne sans épisode
const trackingV2 = [
  "ep_id,ep_no,s_no,runtime,user_id,s_id,gsi,created_at,key,series_follow_count,total_series_runtime,movie_watch_count,total_movies_runtime,updated_at,ep_watch_count,is_archived,uuid,is_followed,most_recent_ep_watched,is_for_later,followed_at,is_unitary,rewatch_count,bulk_type,is_special,movie_name,series_name,season_number,episode_number",
  "1,1,1,40,7105043,73762,k,2018-01-02 20:00:00,watch-episode-1,,,,,,,,,,,,,,,,,,\"Grey's Anatomy, Meredith\",1,1",
  "1,1,1,40,7105043,73762,k,2018-01-01 20:00:00,rewatch-episode-1,,,,,,,,,,,,,,,,,,\"Grey's Anatomy, Meredith\",1,1",
  "2,2,1,40,7105043,73762,k,2018-01-03 20:00:00,watch-episode-2,,,,,,,,,,,,,,,,,,\"Grey's Anatomy, Meredith\",1,2",
  "3,,,,7105043,73762,k,2018-01-04 20:00:00,watch-episode-3,,,,,,,,,,,,,,,,,,\"Grey's Anatomy, Meredith\",,",
].join("\n");

const trackingV1 = [
  "created_at,watch_count,type-uuid-n,user_id,series_id,type,updated_at,uuid,watches,series_uuid,runtime,entity_type,watch_date,episode_number,episode_id,season_number,alpha_range_key,release_date,release_date_range_key,rewatch_count,total_series_runtime,total_movies_runtime,watch_date_range_key,watched_episode_range_key,country,unitarian,bulk_type,movie_name,series_name",
  "2025-05-10 21:50:59,1,x,7105043,,movie,2025-05-10 21:50:59,u,,,7380,movie,,,,,,2014-11-19 00:00:00,,1,,,,,,,,\"The Hunger Games: Mockingjay - Part 1\",",
  "2020-01-01 10:00:00,1,x,7105043,,episode,2020-01-01 10:00:00,u,,,40,episode,,,,,,,,,,,,,,,,,Some Series",
].join("\n");

describe("parseTvTimeExport", () => {
  const out = parseTvTimeExport({ followedShows: followed, trackingV2, trackingV1 });

  it("regroupe les épisodes vus par série, dédupliqués, plus ancienne date", () => {
    const grey = out.series.find((s) => s.tvdbId === "73762")!;
    expect(grey.watched).toHaveLength(2); // (1,1) et (1,2), la ligne sans épisode ignorée
    const e11 = grey.watched.find((w) => w.season === 1 && w.episode === 1)!;
    expect(e11.watchedAt).toEqual(new Date("2018-01-01T20:00:00")); // rewatch antérieur gagne
  });
  it("inclut les séries suivies sans épisode vu (à voir)", () => {
    const toWatch = out.series.find((s) => s.tvdbId === "80000")!;
    expect(toWatch.watched).toHaveLength(0);
    expect(toWatch.name).toBe("To Watch Show");
  });
  it("extrait les films (entity_type=movie) avec année depuis release_date", () => {
    expect(out.movies).toHaveLength(1);
    expect(out.movies[0]).toMatchObject({ name: "The Hunger Games: Mockingjay - Part 1", year: 2014 });
  });
});
