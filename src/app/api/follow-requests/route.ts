import { getDeps } from "@/server/container";
import { listFollowRequests, approveFollowRequest, rejectFollowRequest } from "@/server/application/social";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { z } from "zod";

export async function GET() {
  try {
    const user = await requireUser();
    return json({ requests: await listFollowRequests(await getDeps(), user.id) });
  } catch (e) { return toErrorResponse(e); }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { requestId, action } = z.object({ requestId: z.string(), action: z.enum(["approve", "reject"]) }).parse(await req.json());
    const deps = await getDeps();
    if (action === "approve") await approveFollowRequest(deps, user.id, requestId);
    else await rejectFollowRequest(deps, user.id, requestId);
    return json({ ok: true });
  } catch (e) { return toErrorResponse(e); }
}
