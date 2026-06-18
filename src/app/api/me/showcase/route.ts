import { getDeps } from "@/server/container";
import { updateShowcase } from "@/server/application/showcase";
import { showcaseSchema } from "@/lib/zod-schemas";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { selfUser } from "@/lib/serialize";

export async function PUT(req: Request) {
  try {
    const user = await requireUser();
    const input = showcaseSchema.parse(await req.json());
    return json({ user: selfUser(await updateShowcase(await getDeps(), user.id, input)) });
  } catch (e) { return toErrorResponse(e); }
}
