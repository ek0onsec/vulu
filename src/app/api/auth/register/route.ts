import { getDeps } from "@/server/container";
import { registerWithInvite } from "@/server/application/register-user";
import { authenticateUser } from "@/server/application/authenticate-user";
import { registerSchema } from "@/lib/zod-schemas";
import { setSessionCookie, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { selfUser } from "@/lib/serialize";
import { authLimiter, clientIp } from "@/server/http/rate-limit";
import { AuthError } from "@/server/domain/errors";

export async function POST(req: Request) {
  try {
    if (!authLimiter.allow(clientIp(req))) throw new AuthError("Trop de tentatives, réessaie plus tard");
    const input = registerSchema.parse(await req.json());
    const deps = await getDeps();
    await registerWithInvite(deps, input);
    const { user, token } = await authenticateUser(deps, { email: input.email, password: input.password });
    await setSessionCookie(token);
    return json({ user: selfUser(user), token }, { status: 201 });
  } catch (e) { return toErrorResponse(e); }
}
