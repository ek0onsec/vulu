import { getDeps } from "@/server/container";
import { updateListBanner } from "@/server/application/lists";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser();
    const { id } = await params;
    const bytes = new Uint8Array(await req.arrayBuffer());
    return json({ list: await updateListBanner(await getDeps(), u.id, id, bytes) });
  } catch (e) { return toErrorResponse(e); }
}
