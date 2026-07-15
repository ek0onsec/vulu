import { getDeps } from "@/server/container";
import { buildUserArchive } from "@/server/export/user-archive";
import { requireUser } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { zipSync } from "fflate";

export async function GET() {
  try {
    const user = await requireUser();
    const files = await buildUserArchive(await getDeps(), user.id);
    const zip = zipSync(files);
    return new Response(zip, {
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="vulu-${user.username}-export.zip"`,
      },
    });
  } catch (e) { return toErrorResponse(e); }
}
