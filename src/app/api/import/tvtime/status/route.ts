import { getDeps } from "@/server/container";
import { requireUser, json } from "@/server/http/session";
import { toErrorResponse } from "@/server/http/errors";
import { NotFoundError } from "@/server/domain/errors";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const jobId = new URL(req.url).searchParams.get("jobId") ?? "";
    const deps = await getDeps();
    const job = await deps.importJobs.findById(jobId);
    if (!job || job.userId !== user.id) throw new NotFoundError("Job introuvable");
    return json({ status: job.status, phase: job.phase, done: job.done, total: job.total, report: job.report, error: job.error });
  } catch (e) { return toErrorResponse(e); }
}
