import { getDeps } from "@/server/container";
import { disableTwoFactor } from "@/server/application/two-factor";
import { disable2faSchema } from "@/lib/zod-schemas";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { password } = disable2faSchema.parse(await req.json());
    const deps = await getDeps();
    await disableTwoFactor(deps, user.id, password);
    return json({ ok: true });
  } catch (e) { return toErrorResponse(e); }
}
