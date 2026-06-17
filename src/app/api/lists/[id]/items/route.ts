import { getDeps } from "@/server/container";
import { addWorkToList, removeWorkFromList } from "@/server/application/lists";
import { workRefSchema } from "@/lib/zod-schemas";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { z } from "zod";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser(); const { id } = await params;
    const ref = workRefSchema.parse(await req.json());
    return json({ list: await addWorkToList(await getDeps(), u.id, id, ref) });
  } catch (e) { return toErrorResponse(e); }
}
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser(); const { id } = await params;
    const { workId } = z.object({ workId: z.string() }).parse(await req.json());
    return json({ list: await removeWorkFromList(await getDeps(), u.id, id, workId) });
  } catch (e) { return toErrorResponse(e); }
}
