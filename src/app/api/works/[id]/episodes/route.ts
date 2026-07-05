import { getDeps } from "@/server/container";
import { updateEpisode } from "@/server/application/episode-entry";
import { episodeUpdateSchema } from "@/lib/zod-schemas";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { NotFoundError } from "@/server/domain/errors";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const deps = await getDeps();
    const work = await deps.works.findById(id);
    if (!work || work.type !== "tv") throw new NotFoundError("Série introuvable");
    const input = episodeUpdateSchema.parse(await req.json());
    const watchedAt = input.watchedAt === undefined ? undefined : (input.watchedAt === null ? null : new Date(input.watchedAt));
    const entry = await updateEpisode(
      deps, user.id, { source: work.source, externalId: work.externalId, type: work.type },
      input.season, input.episode,
      { watched: input.watched, watchedAt, rating: input.rating, text: input.text },
    );
    return json({ entry });
  } catch (e) { return toErrorResponse(e); }
}
