import { getDeps } from "@/server/container";
import { communityFeed } from "@/server/application/communities";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser(); const { id } = await params;
    const cursorRaw = new URL(req.url).searchParams.get("cursor");
    const cursor = cursorRaw ? JSON.parse(cursorRaw) as { activityAt: string; id: string } : null;
    const items = await communityFeed(await getDeps(), u.id, id, cursor ? { activityAt: new Date(cursor.activityAt), id: cursor.id } : null);
    const last = items.at(-1);
    const nextCursor = last ? JSON.stringify({ activityAt: last.entry.activityAt ?? last.entry.createdAt, id: last.entry.id }) : null;
    return json({ items, nextCursor });
  } catch (e) { return toErrorResponse(e); }
}
