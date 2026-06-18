import { getDeps } from "@/server/container";
import { getLibrary } from "@/server/application/library";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function GET() {
  try {
    const user = await requireUser();
    return json(await getLibrary(await getDeps(), user.id));
  } catch (e) { return toErrorResponse(e); }
}
