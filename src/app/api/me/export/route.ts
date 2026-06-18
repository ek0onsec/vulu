import { getDeps } from "@/server/container";
import { exportUserData } from "@/server/application/account";
import { requireUser } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function GET() {
  try {
    const user = await requireUser();
    const data = await exportUserData(await getDeps(), user.id);
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "content-type": "application/json",
        "content-disposition": `attachment; filename="vulu-${user.username}.json"`,
      },
    });
  } catch (e) { return toErrorResponse(e); }
}
