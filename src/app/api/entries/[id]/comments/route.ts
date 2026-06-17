import { getDeps } from "@/server/container";
import { commentOnEntry, listComments } from "@/server/application/engagement";
import { commentSchema } from "@/lib/zod-schemas";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const u = await requireUser(); const { id } = await params; return json({ comments: await listComments(await getDeps(), u.id, id) }); }
  catch (e) { return toErrorResponse(e); }
}
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser(); const { id } = await params;
    const { text } = commentSchema.parse(await req.json());
    return json({ comment: await commentOnEntry(await getDeps(), u.id, id, text) }, { status: 201 });
  } catch (e) { return toErrorResponse(e); }
}
