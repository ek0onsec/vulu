import { getDeps } from "@/server/container";
import { updateList, deleteList } from "@/server/application/lists";
import { createListSchema } from "@/lib/zod-schemas";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser(); const { id } = await params;
    const { name, description, visibility } = createListSchema.parse(await req.json());
    return json({ list: await updateList(await getDeps(), u.id, id, { name, description, visibility }) });
  } catch (e) { return toErrorResponse(e); }
}
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const u = await requireUser(); const { id } = await params; await deleteList(await getDeps(), u.id, id); return json({ ok: true }); }
  catch (e) { return toErrorResponse(e); }
}
