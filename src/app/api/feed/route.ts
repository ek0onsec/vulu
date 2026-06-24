import { getDeps } from "@/server/container";
import { buildFeed } from "@/server/application/feed";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const sp = new URL(req.url).searchParams;
    const scope = sp.get("scope") === "following" ? "following" : "foryou";
    const cursorRaw = sp.get("cursor");
    const cursor = cursorRaw ? JSON.parse(cursorRaw) as { activityAt: string; id: string } : null;
    const items = await buildFeed(await getDeps(), user.id, {
      scope,
      cursor: cursor ? { activityAt: new Date(cursor.activityAt), id: cursor.id } : null,
      limit: 20,
    });
    const last = items.at(-1);
    const nextCursor = last ? JSON.stringify({ activityAt: last.entry.activityAt ?? last.entry.createdAt, id: last.entry.id }) : null;
    return json({ items, nextCursor });
  } catch (e) { return toErrorResponse(e); }
}
