import { getDeps } from "@/server/container";
import { getSeasonEpisodes } from "@/server/application/get-episodes";
import { getEpisodeEntries } from "@/server/application/episode-entry";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { NotFoundError } from "@/server/domain/errors";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; season: string }> }) {
  try {
    const user = await requireUser();
    const { id, season } = await params;
    const deps = await getDeps();
    const work = await deps.works.findById(id);
    if (!work || work.type !== "tv") throw new NotFoundError("Série introuvable");
    const seasonNum = Number(season);
    const [episodes, allEntries] = await Promise.all([
      getSeasonEpisodes(deps, { source: work.source, externalId: work.externalId, type: work.type }, seasonNum),
      getEpisodeEntries(deps, user.id, work.id),
    ]);
    return json({ episodes, entries: allEntries.filter((e) => e.season === seasonNum) });
  } catch (e) { return toErrorResponse(e); }
}
