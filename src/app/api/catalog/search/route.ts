import { getDeps } from "@/server/container";
import { searchCatalog } from "@/server/application/catalog";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function GET(req: Request) {
  try {
    await requireUser();
    const sp = new URL(req.url).searchParams;
    const q = sp.get("q")?.trim() ?? "";
    const domain = sp.get("domain") === "books" ? "books" : "films";
    if (!q) return json({ results: [] });
    return json({ results: await searchCatalog(await getDeps(), q, domain) });
  } catch (e) { return toErrorResponse(e); }
}
