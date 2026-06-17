import { getDeps } from "@/server/container";
import { createList, listsOf } from "@/server/application/lists";
import { createListSchema } from "@/lib/zod-schemas";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function GET() {
  try { const u = await requireUser(); return json({ lists: await listsOf(await getDeps(), u.id) }); }
  catch (e) { return toErrorResponse(e); }
}
export async function POST(req: Request) {
  try {
    const u = await requireUser();
    const input = createListSchema.parse(await req.json());
    return json({ list: await createList(await getDeps(), u.id, input) }, { status: 201 });
  } catch (e) { return toErrorResponse(e); }
}
