import { getDeps } from "@/server/container";
import { shareMilestone } from "@/server/application/library-entry";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const entry = await shareMilestone(await getDeps(), user.id, id);
    return json({ entry });
  } catch (e) { return toErrorResponse(e); }
}
