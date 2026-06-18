import { getDeps } from "@/server/container";
import { commentOnEntry, listComments } from "@/server/application/engagement";
import { commentSchema } from "@/lib/zod-schemas";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import type { Comment, User } from "@/server/domain/entities";

function present(c: Comment, author: User | null) {
  return {
    id: c.id, text: c.text, createdAt: c.createdAt,
    author: author
      ? { username: author.username, displayName: author.displayName, avatarUrl: author.avatarUrl, plus: author.plus, staff: author.staff }
      : { username: "inconnu", displayName: "Utilisateur", avatarUrl: null, plus: false, staff: false },
  };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser();
    const { id } = await params;
    const deps = await getDeps();
    const comments = await listComments(deps, u.id, id);
    const enriched = await Promise.all(comments.map(async (c) => present(c, await deps.users.findById(c.userId))));
    return json({ comments: enriched });
  } catch (e) { return toErrorResponse(e); }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser();
    const { id } = await params;
    const { text } = commentSchema.parse(await req.json());
    const comment = await commentOnEntry(await getDeps(), u.id, id, text);
    return json({ comment: present(comment, u) }, { status: 201 });
  } catch (e) { return toErrorResponse(e); }
}
