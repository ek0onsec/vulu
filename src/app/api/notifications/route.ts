import { getDeps } from "@/server/container";
import { buildNotifications } from "@/server/application/notifications";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function GET() {
  try {
    const user = await requireUser();
    return json({ notifications: await buildNotifications(await getDeps(), user.id) });
  } catch (e) { return toErrorResponse(e); }
}
