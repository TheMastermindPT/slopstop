import {
  ProjectActivationIdSchema,
  ProjectIdSchema,
  WriterGenerationSchema,
} from "@slopstop/protocol";
import { expect, it, vi } from "vitest";
import * as writers from "./canonical-project-writer.js";
import { CanonicalWriterLeaseError } from "./storage/canonical-writer-lease.js";

it("refuses stale fences and preserves native close failure", async () => {
  const create = writers.createCanonicalProjectWriter;
  expect(create).toBeTypeOf("function");
  if (typeof create !== "function") throw new Error("Writer factory is missing.");
  for (const scenario of [
    {
      status: "stale",
      code: "WRITER_FENCE_STALE",
      fenceCount: 2,
      repositoryCount: 0,
      leaseCount: 0,
    },
    {
      status: "current",
      code: "WRITER_LEASE_CLOSE_FAILED",
      fenceCount: 1,
      repositoryCount: 1,
      leaseCount: 2,
    },
  ] as const) {
    const { status, code } = scenario;
    const projectId = ProjectIdSchema.parse("00000000-0000-4000-8000-000000000010");
    const writerGeneration = WriterGenerationSchema.parse(1);
    const repository = {
      projectId,
      writerGeneration,
      verifyFence: async () => ({ status }),
      releaseFence: vi.fn(async () => ({ status })),
      close: vi.fn(async () => undefined),
    };
    const lease = {
      release: vi.fn(async () => {
        throw new CanonicalWriterLeaseError("WRITER_LEASE_CLOSE_FAILED");
      }),
    };
    const writer = create({
      projectId,
      writerGeneration,
      activationId: ProjectActivationIdSchema.parse("00000000-0000-4000-8000-000000000011"),
      repository,
      lease,
    });
    await expect(writer.close("2026-09-04T12:01:00.000Z")).rejects.toMatchObject({ code });
    await expect(writer.close("2026-09-04T12:01:00.000Z")).rejects.toMatchObject({ code });
    expect(repository.releaseFence).toHaveBeenCalledTimes(scenario.fenceCount);
    expect(repository.close).toHaveBeenCalledTimes(scenario.repositoryCount);
    expect(lease.release).toHaveBeenCalledTimes(scenario.leaseCount);
  }
});

it("retains failed release ownership and resumes cleanup on stop retry", async () => {
  const create = writers.createCanonicalProjectWriter;
  expect(create).toBeTypeOf("function");
  if (typeof create !== "function") throw new Error("Writer factory is missing.");
  for (const stage of ["fence", "repository", "lease"] as const) {
    const calls: string[] = [];
    let fail = true;
    const touch = (current: string) => {
      calls.push(current);
      if (fail && stage === current) {
        fail = false;
        throw new Error("failure");
      }
    };
    const projectId = ProjectIdSchema.parse("00000000-0000-4000-8000-000000000010");
    const writerGeneration = WriterGenerationSchema.parse(1);
    const repository = {
      projectId,
      writerGeneration,
      verifyFence: vi.fn(async () => ({ status: "current" as const })),
      releaseFence: vi.fn(async () => {
        touch("fence");
        return { status: "current" as const };
      }),
      close: vi.fn(async () => {
        touch("repository");
      }),
    };
    const lease = {
      release: vi.fn(async () => {
        try {
          touch("lease");
        } catch {
          throw new CanonicalWriterLeaseError("WRITER_LEASE_UNLOCK_FAILED");
        }
      }),
    };
    const writer = create({
      projectId,
      writerGeneration,
      activationId: ProjectActivationIdSchema.parse("00000000-0000-4000-8000-000000000011"),
      repository,
      lease,
    });
    const first = writer.close("2026-09-04T12:01:00.000Z");
    expect(writer.close("2026-09-04T12:01:00.000Z")).toBe(first);
    const codes = {
      fence: "WRITER_FENCE_RELEASE_FAILED",
      repository: "WRITER_REPOSITORY_CLOSE_FAILED",
      lease: "WRITER_LEASE_UNLOCK_FAILED",
    };
    await expect(first).rejects.toMatchObject({ code: codes[stage] });
    await writer.close("2026-09-04T12:01:00.000Z");
    await writer.close("2026-09-04T12:01:00.000Z");
    const expected = {
      fence: ["fence", "fence", "repository", "lease"],
      repository: ["fence", "repository", "repository", "lease"],
      lease: ["fence", "repository", "lease", "lease"],
    };
    expect(calls).toEqual(expected[stage]);
  }
});
