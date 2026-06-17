import { getDeps } from "@/server/container";
import { deleteComment } from "@/server/application/engagement";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const u = await requireUser(); const { id } = await params; await deleteComment(await getDeps(), u.id, id); return json({ ok: true }); }
  catch (e) { return toErrorResponse(e); }
}
