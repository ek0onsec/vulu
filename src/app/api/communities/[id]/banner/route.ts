import { getDeps } from "@/server/container";
import { setCommunityBanner } from "@/server/application/communities";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { readImageBody } from "@/server/http/read-image-body";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const bytes = await readImageBody(req);
    const community = await setCommunityBanner(await getDeps(), user.id, id, bytes);
    return json({ community });
  } catch (e) { return toErrorResponse(e); }
}
