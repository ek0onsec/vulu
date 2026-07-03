import { getDeps } from "@/server/container";
import { currentUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { NotFoundError, ForbiddenError } from "@/server/domain/errors";
import { canViewProfile } from "@/server/application/social";
import { listFollowing } from "@/server/application/follow-lists";

export async function GET(_req: Request, { params }: { params: Promise<{ username: string }> }) {
  try {
    const { username } = await params;
    const deps = await getDeps();
    const target = await deps.users.findByUsername(username.toLowerCase());
    if (!target) throw new NotFoundError("Profil introuvable");
    const viewer = await currentUser();
    if (!(await canViewProfile(deps, viewer?.id ?? "", target))) throw new ForbiddenError("Profil privé");
    return json({ users: await listFollowing(deps, target.id) });
  } catch (e) { return toErrorResponse(e); }
}
