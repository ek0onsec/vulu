import { getDeps } from "@/server/container";
import { listGenres } from "@/server/application/catalog";
import { json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function GET() {
  try { return json({ genres: await listGenres(await getDeps()) }); }
  catch (e) { return toErrorResponse(e); }
}
