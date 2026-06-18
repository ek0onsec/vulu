import { getDeps } from "@/server/container";
import { listGenres } from "@/server/application/catalog";
import { json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function GET(req: Request) {
  try {
    const domain = new URL(req.url).searchParams.get("domain") === "books" ? "books" : "films";
    return json({ genres: await listGenres(await getDeps(), domain) });
  } catch (e) { return toErrorResponse(e); }
}
