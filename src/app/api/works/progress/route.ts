import { getDeps } from "@/server/container";
import { updateProgress } from "@/server/application/library-entry";
import { progressSchema } from "@/lib/zod-schemas";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function PUT(req: Request) {
  try {
    const user = await requireUser();
    const input = progressSchema.parse(await req.json());
    const { ref, ...progress } = input;
    const entry = await updateProgress(await getDeps(), user.id, ref, progress);
    return json({ entry });
  } catch (e) { return toErrorResponse(e); }
}
