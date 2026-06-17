import { getDeps } from "@/server/container";
import { searchCatalog } from "@/server/application/catalog";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function GET(req: Request) {
  try {
    await requireUser();
    const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
    if (!q) return json({ results: [] });
    return json({ results: await searchCatalog(await getDeps(), q) });
  } catch (e) { return toErrorResponse(e); }
}
