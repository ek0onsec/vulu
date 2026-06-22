import { getDeps } from "@/server/container";
import { myInvites } from "@/server/application/communities";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function GET() {
  try { const u = await requireUser(); return json({ invites: await myInvites(await getDeps(), u.id) }); }
  catch (e) { return toErrorResponse(e); }
}
