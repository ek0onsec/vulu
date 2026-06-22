import { getDeps } from "@/server/container";
import { setMemberRole } from "@/server/application/communities";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { z } from "zod";

export async function POST(req: Request, { params }: { params: Promise<{ id: string; userId: string }> }) {
  try {
    const u = await requireUser(); const { id, userId } = await params;
    const { role } = z.object({ role: z.enum(["member", "moderator"]) }).parse(await req.json());
    await setMemberRole(await getDeps(), u.id, id, userId, role);
    return json({ ok: true });
  } catch (e) { return toErrorResponse(e); }
}
