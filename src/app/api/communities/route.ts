import { getDeps } from "@/server/container";
import { listPublicCommunities, createCommunity } from "@/server/application/communities";
import { createCommunitySchema } from "@/lib/zod-schemas";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function GET() {
  try { const u = await requireUser(); return json({ communities: await listPublicCommunities(await getDeps(), u.id) }); }
  catch (e) { return toErrorResponse(e); }
}
export async function POST(req: Request) {
  try {
    const u = await requireUser();
    const input = createCommunitySchema.parse(await req.json());
    return json({ community: await createCommunity(await getDeps(), u.id, input) }, { status: 201 });
  } catch (e) { return toErrorResponse(e); }
}
