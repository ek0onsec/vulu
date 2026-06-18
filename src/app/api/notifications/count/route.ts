import { getDeps } from "@/server/container";
import { countUnreadNotifications } from "@/server/application/notifications";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function GET() {
  try {
    const user = await requireUser();
    return json({ unreadCount: await countUnreadNotifications(await getDeps(), user.id) });
  } catch (e) { return toErrorResponse(e); }
}
