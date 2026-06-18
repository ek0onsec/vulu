import { getDeps } from "@/server/container";
import { changeUsername } from "@/server/application/account";
import { changeUsernameSchema } from "@/lib/zod-schemas";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { selfUser } from "@/lib/serialize";

export async function PUT(req: Request) {
  try {
    const user = await requireUser();
    const { username, currentPassword } = changeUsernameSchema.parse(await req.json());
    return json({ user: selfUser(await changeUsername(await getDeps(), user.id, username, currentPassword)) });
  } catch (e) { return toErrorResponse(e); }
}
