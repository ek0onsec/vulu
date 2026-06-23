import { getDeps } from "@/server/container";
import { updateListBanner } from "@/server/application/lists";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { readImageBody } from "@/server/http/read-image-body";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser();
    const { id } = await params;
    const bytes = await readImageBody(req);
    return json({ list: await updateListBanner(await getDeps(), u.id, id, bytes) });
  } catch (e) { return toErrorResponse(e); }
}
