import { getDeps } from "@/server/container";
import { setCommunityVisibility } from "@/server/application/communities";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { z } from "zod";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser(); const { id } = await params;
    const { visibility } = z.object({ visibility: z.enum(["public", "private"]) }).parse(await req.json());
    await setCommunityVisibility(await getDeps(), u.id, id, visibility);
    return json({ ok: true });
  } catch (e) { return toErrorResponse(e); }
}
