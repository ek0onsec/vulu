import { getDeps } from "@/server/container";
import { getOrImportWork } from "@/server/application/get-work";
import { workRefSchema } from "@/lib/zod-schemas";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function POST(req: Request) {
  try {
    await requireUser();
    const ref = workRefSchema.parse(await req.json());
    const work = await getOrImportWork(await getDeps(), ref);
    return json({ work });
  } catch (e) { return toErrorResponse(e); }
}
