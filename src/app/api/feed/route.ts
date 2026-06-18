import { getDeps } from "@/server/container";
import { buildFeed } from "@/server/application/feed";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const sp = new URL(req.url).searchParams;
    const scope = sp.get("scope") === "circle" ? "circle" : "foryou";
    const cursorRaw = sp.get("cursor");
    const cursor = cursorRaw ? JSON.parse(cursorRaw) as { createdAt: string; id: string } : null;
    const items = await buildFeed(await getDeps(), user.id, {
      scope,
      cursor: cursor ? { createdAt: new Date(cursor.createdAt), id: cursor.id } : null,
      limit: 20,
    });
    const last = items.at(-1);
    const nextCursor = last ? JSON.stringify({ createdAt: last.entry.createdAt, id: last.entry.id }) : null;
    return json({ items, nextCursor });
  } catch (e) { return toErrorResponse(e); }
}
