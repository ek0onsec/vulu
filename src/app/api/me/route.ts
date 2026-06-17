import { getDeps } from "@/server/container";
import { updateProfile } from "@/server/application/update-profile";
import { updateProfileSchema } from "@/lib/zod-schemas";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { selfUser } from "@/lib/serialize";

export async function GET() {
  try { return json({ user: selfUser(await requireUser()) }); }
  catch (e) { return toErrorResponse(e); }
}
export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    const input = updateProfileSchema.parse(await req.json());
    const deps = await getDeps();
    const updated = await updateProfile(deps, user.id, input);
    return json({ user: selfUser(updated) });
  } catch (e) { return toErrorResponse(e); }
}
