import { getDeps } from "@/server/container";
import { acceptInvite, declineInvite } from "@/server/application/communities";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { z } from "zod";

export async function POST(req: Request, { params }: { params: Promise<{ reqId: string }> }) {
  try {
    const u = await requireUser(); const { reqId } = await params;
    const { action } = z.object({ action: z.enum(["accept", "decline"]) }).parse(await req.json());
    const deps = await getDeps();
    if (action === "accept") await acceptInvite(deps, u.id, reqId); else await declineInvite(deps, u.id, reqId);
    return json({ ok: true });
  } catch (e) { return toErrorResponse(e); }
}
