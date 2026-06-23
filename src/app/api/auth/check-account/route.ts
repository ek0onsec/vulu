import { getDeps } from "@/server/container";
import { checkSignupAvailability } from "@/server/application/signup-availability";
import { checkAccountSchema } from "@/lib/zod-schemas";
import { json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { authLimiter, clientIp } from "@/server/http/rate-limit";
import { AuthError } from "@/server/domain/errors";

export async function GET(req: Request) {
  try {
    if (!authLimiter.allow(clientIp(req))) throw new AuthError("Trop de tentatives, réessaie plus tard");
    const sp = new URL(req.url).searchParams;
    const { u, e } = checkAccountSchema.parse({ u: sp.get("u") ?? "", e: sp.get("e") ?? "" });
    return json({ ...(await checkSignupAvailability(await getDeps(), { username: u, email: e })) });
  } catch (err) { return toErrorResponse(err); }
}
