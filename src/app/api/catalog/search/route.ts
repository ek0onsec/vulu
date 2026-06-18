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
    try {
      return json({ results: await searchCatalog(await getDeps(), q, domain) });
    } catch (catalogError) {
      // Panne/limite du fournisseur externe : on dégrade proprement plutôt qu'un 500.
      console.error("Catalogue indisponible:", catalogError);
      return json({ results: [], unavailable: true });
    }
  } catch (e) { return toErrorResponse(e); }
}
