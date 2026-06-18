import { getDeps } from "@/server/container";
import { setAccountPrivacy } from "@/server/application/social";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { selfUser } from "@/lib/serialize";
import { z } from "zod";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { private: isPrivate } = z.object({ private: z.boolean() }).parse(await req.json());
    return json({ user: selfUser(await setAccountPrivacy(await getDeps(), user.id, isPrivate)) });
  } catch (e) { return toErrorResponse(e); }
}
