import { getDeps } from "@/server/container";
import { searchPeople } from "@/server/application/catalog";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function GET(req: Request) {
  try {
    await requireUser();
    const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
    if (!q) return json({ results: [] });
    return json({ results: await searchPeople(await getDeps(), q) });
  } catch (e) { return toErrorResponse(e); }
}
