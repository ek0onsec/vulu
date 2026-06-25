import { getDeps } from "@/server/container";
import { findBookByIsbn } from "@/server/application/find-book-by-isbn";
import { isbnSchema } from "@/lib/zod-schemas";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function GET(req: Request) {
  try {
    await requireUser();
    const { isbn } = isbnSchema.parse({ isbn: new URL(req.url).searchParams.get("isbn") ?? "" });
    const result = await findBookByIsbn(await getDeps(), isbn);
    return json({ result });
  } catch (e) { return toErrorResponse(e); }
}
