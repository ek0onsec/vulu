import { getDeps } from "@/server/container";
import { confirmTwoFactorSetup } from "@/server/application/two-factor";
import { totpCodeSchema } from "@/lib/zod-schemas";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { code } = totpCodeSchema.parse(await req.json());
    const deps = await getDeps();
    const { backupCodes } = await confirmTwoFactorSetup(deps, user.id, code);
    return json({ backupCodes });
  } catch (e) { return toErrorResponse(e); }
}
