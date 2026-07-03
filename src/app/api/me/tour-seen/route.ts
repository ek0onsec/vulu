import { getDeps } from "@/server/container";
import { markTourSeen } from "@/server/application/tour";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { selfUser } from "@/lib/serialize";

export async function POST() {
  try {
    const user = await requireUser();
    return json({ user: selfUser(await markTourSeen(await getDeps(), user.id)) });
  } catch (e) { return toErrorResponse(e); }
}
