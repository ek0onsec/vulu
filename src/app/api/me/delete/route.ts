import { getDeps } from "@/server/container";
import { requestAccountDeletion } from "@/server/application/account";
import { requireUser, clearSessionCookie, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function POST() {
  try {
    const user = await requireUser();
    await requestAccountDeletion(await getDeps(), user.id);
    await clearSessionCookie(); // déconnexion immédiate
    return json({ ok: true });
  } catch (e) { return toErrorResponse(e); }
}
