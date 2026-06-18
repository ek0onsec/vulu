import { getDeps } from "@/server/container";
import { requestOrFollow, unfollowUser } from "@/server/application/social";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { NotFoundError } from "@/server/domain/errors";

async function targetId(username: string) {
  const deps = await getDeps();
  const target = await deps.users.findByUsername(username.toLowerCase());
  if (!target) throw new NotFoundError("Profil introuvable");
  return { deps, targetId: target.id };
}

export async function POST(_req: Request, { params }: { params: Promise<{ username: string }> }) {
  try {
    const user = await requireUser();
    const { username } = await params;
    const { deps, targetId: id } = await targetId(username);
    const result = await requestOrFollow(deps, user.id, id);
    return json({ result });
  } catch (e) { return toErrorResponse(e); }
}
export async function DELETE(_req: Request, { params }: { params: Promise<{ username: string }> }) {
  try {
    const user = await requireUser();
    const { username } = await params;
    const { deps, targetId: id } = await targetId(username);
    await unfollowUser(deps, user.id, id);
    return json({ ok: true });
  } catch (e) { return toErrorResponse(e); }
}
