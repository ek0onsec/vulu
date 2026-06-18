import { getDeps } from "@/server/container";
import { markNotificationsSeen } from "@/server/application/notifications";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function POST() {
  try {
    const user = await requireUser();
    await markNotificationsSeen(await getDeps(), user.id);
    return json({ ok: true });
  } catch (e) { return toErrorResponse(e); }
}
