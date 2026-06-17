import { getDeps } from "@/server/container";
import { authenticateUser } from "@/server/application/authenticate-user";
import { loginSchema } from "@/lib/zod-schemas";
import { setSessionCookie, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { selfUser } from "@/lib/serialize";
import { authLimiter, clientIp } from "@/server/http/rate-limit";
import { AuthError } from "@/server/domain/errors";

export async function POST(req: Request) {
  try {
    if (!authLimiter.allow(clientIp(req))) throw new AuthError("Trop de tentatives, réessaie plus tard");
    const input = loginSchema.parse(await req.json());
    const deps = await getDeps();
    const { user, token } = await authenticateUser(deps, input);
    await setSessionCookie(token);
    return json({ user: selfUser(user) });
  } catch (e) { return toErrorResponse(e); }
}
