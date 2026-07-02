import { getDeps } from "@/server/container";
import { completeTwoFactorLogin } from "@/server/application/two-factor";
import { twoFactorLoginSchema } from "@/lib/zod-schemas";
import { setSessionCookie, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { selfUser } from "@/lib/serialize";
import { authLimiter, clientIp } from "@/server/http/rate-limit";
import { AuthError } from "@/server/domain/errors";

export async function POST(req: Request) {
  try {
    if (!authLimiter.allow(clientIp(req))) throw new AuthError("Trop de tentatives, réessaie plus tard");
    const { challenge, code } = twoFactorLoginSchema.parse(await req.json());
    const deps = await getDeps();
    const { token } = await completeTwoFactorLogin(deps, challenge, code);
    await setSessionCookie(token);
    const payload = await deps.tokens.verify(token);
    const user = payload ? await deps.users.findById(payload.userId) : null;
    if (!user) throw new AuthError("Session invalide");
    return json({ user: selfUser(user) });
  } catch (e) { return toErrorResponse(e); }
}
