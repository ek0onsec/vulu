import { getDeps } from "@/server/container";
import { joinCommunity, leaveCommunity } from "@/server/application/communities";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const u = await requireUser(); const { id } = await params; await joinCommunity(await getDeps(), u.id, id); return json({ ok: true }); }
  catch (e) { return toErrorResponse(e); }
}
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const u = await requireUser(); const { id } = await params; await leaveCommunity(await getDeps(), u.id, id); return json({ ok: true }); }
  catch (e) { return toErrorResponse(e); }
}
