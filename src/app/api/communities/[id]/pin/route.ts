import { getDeps } from "@/server/container";
import { setCommunityPinned } from "@/server/application/communities";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { z } from "zod";
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser(); const { id } = await params;
    const { pinned } = z.object({ pinned: z.boolean() }).parse(await req.json());
    await setCommunityPinned(await getDeps(), u.id, id, pinned);
    return json({ ok: true });
  } catch (e) { return toErrorResponse(e); }
}
