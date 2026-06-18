import { getDeps } from "@/server/container";
import { changePassword } from "@/server/application/account";
import { changePasswordSchema } from "@/lib/zod-schemas";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function PUT(req: Request) {
  try {
    const user = await requireUser();
    const { currentPassword, newPassword } = changePasswordSchema.parse(await req.json());
    await changePassword(await getDeps(), user.id, currentPassword, newPassword);
    return json({ ok: true });
  } catch (e) { return toErrorResponse(e); }
}
