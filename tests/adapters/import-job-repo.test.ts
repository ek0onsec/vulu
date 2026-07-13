import { describe, it, expect } from "vitest";
import { InMemoryImportJobRepository } from "@/server/adapters/memory";
import type { ImportJob } from "@/server/domain/entities";

function job(): ImportJob {
  const now = new Date();
  return { id: "j1", userId: "u1", status: "pending", phase: "series", done: 0, total: 3,
    report: null, error: null, createdAt: now, updatedAt: now };
}

describe("InMemoryImportJobRepository", () => {
  it("crée, relit et met à jour un job", async () => {
    const repo = new InMemoryImportJobRepository();
    await repo.create(job());
    expect((await repo.findById("j1"))!.status).toBe("pending");
    await repo.update({ ...job(), status: "done", done: 3 });
    const j = await repo.findById("j1");
    expect(j!.status).toBe("done");
    expect(j!.done).toBe(3);
  });
  it("renvoie null si absent", async () => {
    expect(await new InMemoryImportJobRepository().findById("x")).toBeNull();
  });
});
