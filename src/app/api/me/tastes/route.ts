import { getDeps } from "@/server/container";
import { updateTastes } from "@/server/application/update-tastes";
import { tastesSchema } from "@/lib/zod-schemas";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { selfUser } from "@/lib/serialize";

export async function PUT(req: Request) {
  try {
    const u = await requireUser();
    const tastes = tastesSchema.parse(await req.json());
    return json({ user: selfUser(await updateTastes(await getDeps(), u.id, tastes)) });
  } catch (e) { return toErrorResponse(e); }
}
