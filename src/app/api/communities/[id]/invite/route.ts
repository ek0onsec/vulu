import { getDeps } from "@/server/container";
import { inviteToCommunity } from "@/server/application/communities";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { z } from "zod";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser(); const { id } = await params;
    const { username } = z.object({ username: z.string().min(1) }).parse(await req.json());
    await inviteToCommunity(await getDeps(), u.id, id, username);
    return json({ ok: true });
  } catch (e) { return toErrorResponse(e); }
}
