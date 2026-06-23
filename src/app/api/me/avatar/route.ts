import { getDeps } from "@/server/container";
import { updateAvatar } from "@/server/application/profile-media";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { readImageBody } from "@/server/http/read-image-body";
import { selfUser } from "@/lib/serialize";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const bytes = await readImageBody(req);
    const updated = await updateAvatar(await getDeps(), user.id, bytes);
    return json({ user: selfUser(updated) });
  } catch (e) { return toErrorResponse(e); }
}
