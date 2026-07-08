import { getDeps } from "@/server/container";
import { getMyInvite } from "@/server/application/invite";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function GET() {
  try {
    const user = await requireUser();
    return json(await getMyInvite(await getDeps(), user.id));
  } catch (e) { return toErrorResponse(e); }
}
