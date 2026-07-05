import { getDeps } from "@/server/container";
import { getPostItem } from "@/server/application/feed";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    return json({ item: await getPostItem(await getDeps(), user.id, id) });
  } catch (e) { return toErrorResponse(e); }
}
