import { getDeps } from "@/server/container";
import { markAllEpisodes } from "@/server/application/episode-entry";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { NotFoundError } from "@/server/domain/errors";
import { z } from "zod";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const deps = await getDeps();
    const work = await deps.works.findById(id);
    if (!work || work.type !== "tv") throw new NotFoundError("Série introuvable");
    const { watched } = z.object({ watched: z.boolean() }).parse(await req.json());
    await markAllEpisodes(deps, user.id, { source: work.source, externalId: work.externalId, type: work.type }, watched);
    return json({ ok: true });
  } catch (e) { return toErrorResponse(e); }
}
