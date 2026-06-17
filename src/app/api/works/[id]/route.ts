import { getDeps } from "@/server/container";
import { json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { NotFoundError } from "@/server/domain/errors";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const deps = await getDeps();
    const work = await deps.works.findById(id);
    if (!work) throw new NotFoundError("Œuvre introuvable");
    return json({ work });
  } catch (e) { return toErrorResponse(e); }
}
