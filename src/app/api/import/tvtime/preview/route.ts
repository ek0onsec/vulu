import { parseZip, buildPreview } from "@/server/import/tvtime-zip";
import { readUploadBody } from "@/server/http/read-upload-body";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";

export async function POST(req: Request) {
  try {
    await requireUser();
    const bytes = await readUploadBody(req);
    return json(buildPreview(parseZip(bytes)));
  } catch (e) { return toErrorResponse(e); }
}
