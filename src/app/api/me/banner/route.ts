import { getDeps } from "@/server/container";
import { updateBanner } from "@/server/application/profile-media";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { selfUser } from "@/lib/serialize";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const bytes = new Uint8Array(await req.arrayBuffer());
    const updated = await updateBanner(await getDeps(), user.id, bytes);
    return json({ user: selfUser(updated) });
  } catch (e) { return toErrorResponse(e); }
}
