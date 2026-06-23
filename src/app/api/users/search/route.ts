import { getDeps } from "@/server/container";
import { searchUsers } from "@/server/application/search-users";
import { userSearchSchema } from "@/lib/zod-schemas";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
    if (!q) return json({ users: [] });
    const { q: query } = userSearchSchema.parse({ q });
    return json({ users: await searchUsers(await getDeps(), user.id, query) });
  } catch (e) { return toErrorResponse(e); }
}
