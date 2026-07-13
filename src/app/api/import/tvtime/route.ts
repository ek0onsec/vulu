import { getDeps } from "@/server/container";
import { parseZip } from "@/server/import/tvtime-zip";
import { runImportJob } from "@/server/application/import-tvtime";
import { readUploadBody } from "@/server/http/read-upload-body";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import type { ImportJob } from "@/server/domain/entities";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const bytes = await readUploadBody(req);
    const data = parseZip(bytes);
    const deps = await getDeps();
    const now = deps.clock.now();
    const job: ImportJob = {
      id: deps.ids.next(), userId: user.id, status: "pending", phase: "series",
      done: 0, total: data.series.length, report: null, error: null, createdAt: now, updatedAt: now,
    };
    await deps.importJobs.create(job);
    // Fire-and-forget : en local (process persistant) l'import va au bout ; les erreurs sont capturées dans le job.
    void runImportJob(deps, job.id, user.id, data).catch(() => {});
    return json({ jobId: job.id });
  } catch (e) { return toErrorResponse(e); }
}
