import { getDeps } from "@/server/container";
import { getCommunity } from "@/server/application/communities";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const u = await requireUser(); const { id } = await params; return json({ community: await getCommunity(await getDeps(), u.id, id) }); }
  catch (e) { return toErrorResponse(e); }
}
