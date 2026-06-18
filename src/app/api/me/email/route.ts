import { getDeps } from "@/server/container";
import { changeEmail } from "@/server/application/account";
import { changeEmailSchema } from "@/lib/zod-schemas";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { selfUser } from "@/lib/serialize";

export async function PUT(req: Request) {
  try {
    const user = await requireUser();
    const { email, currentPassword } = changeEmailSchema.parse(await req.json());
    return json({ user: selfUser(await changeEmail(await getDeps(), user.id, email, currentPassword)) });
  } catch (e) { return toErrorResponse(e); }
}
