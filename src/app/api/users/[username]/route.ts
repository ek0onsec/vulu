import { getDeps } from "@/server/container";
import { currentUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { NotFoundError } from "@/server/domain/errors";
import { getCircle } from "@/server/application/social";
import { publicUser } from "@/lib/serialize";

export async function GET(_req: Request, { params }: { params: Promise<{ username: string }> }) {
  try {
    const { username } = await params;
    const deps = await getDeps();
    const target = await deps.users.findByUsername(username.toLowerCase());
    if (!target) throw new NotFoundError("Profil introuvable");
    const viewer = await currentUser();
    const inCircle = viewer ? (await getCircle(deps, viewer.id)).has(target.id) : false;
    const isSelf = viewer?.id === target.id;
    const visibleEntries = (await deps.entries.listByUser(target.id, { status: "done" }))
      .filter((e) => e.visibility === "public" || isSelf || inCircle);
    const lists = (await deps.lists.listByUser(target.id))
      .filter((l) => l.visibility === "public" || isSelf);
    const [followers, following] = await Promise.all([deps.follows.countFollowers(target.id), deps.follows.countFollowing(target.id)]);
    return json({
      profile: publicUser(target),
      stats: { followers, following, watched: visibleEntries.length },
      relation: { isSelf, isFollowing: viewer ? await deps.follows.exists(viewer.id, target.id) : false },
      entries: visibleEntries, lists,
    });
  } catch (e) { return toErrorResponse(e); }
}
