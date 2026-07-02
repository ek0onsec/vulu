import { getDeps } from "@/server/container";
import { beginTwoFactorSetup } from "@/server/application/two-factor";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function POST() {
  try {
    const user = await requireUser();
    const deps = await getDeps();
    const { keyUri, secret, qrSvg } = await beginTwoFactorSetup(deps, user.id);
    return json({ keyUri, secret, qrSvg });
  } catch (e) { return toErrorResponse(e); }
}
