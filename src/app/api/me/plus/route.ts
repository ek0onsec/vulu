import { getDeps } from "@/server/container";
import { setPlus } from "@/server/application/subscribe-plus";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { selfUser } from "@/lib/serialize";
import { z } from "zod";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { active } = z.object({ active: z.boolean() }).parse(await req.json());
    return json({ user: selfUser(await setPlus(await getDeps(), user.id, active)) });
  } catch (e) { return toErrorResponse(e); }
}
