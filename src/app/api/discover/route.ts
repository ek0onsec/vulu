import { getDeps } from "@/server/container";
import { discover } from "@/server/application/discover";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function GET() {
  try {
    const user = await requireUser();
    return json(await discover(await getDeps(), user.id));
  } catch (e) { return toErrorResponse(e); }
}
