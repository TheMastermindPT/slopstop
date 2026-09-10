import type { ProjectActivationId, ProjectId, WriterGeneration } from "@slopstop/protocol";
import type { CanonicalCommandRepository } from "./storage/canonical-command-repository.js";
import type {
  CanonicalWriterLease,
  CanonicalWriterLeaseFailureCode,
} from "./storage/canonical-writer-lease.js";
import { CanonicalWriterLeaseError } from "./storage/canonical-writer-lease.js";
export type CanonicalProjectWriterReleaseFailureCode =
  | "WRITER_FENCE_STALE"
  | "WRITER_FENCE_RELEASE_FAILED"
  | "WRITER_REPOSITORY_CLOSE_FAILED"
  | CanonicalWriterLeaseFailureCode;
export interface CanonicalProjectWriter {
  readonly projectId: ProjectId;
  readonly activationId: ProjectActivationId;
  readonly writerGeneration: WriterGeneration;
  verifyFence(): Promise<
    { status: "current" | "stale" } | { status: "broken"; code: "WRITER_FENCE_CHECK_FAILED" }
  >;
  close(releasedAt: string): Promise<void>;
}
export type CanonicalProjectWriterInput = Readonly<{
  projectId: ProjectId;
  activationId: ProjectActivationId;
  writerGeneration: WriterGeneration;
  repository: CanonicalCommandRepository;
  lease: CanonicalWriterLease;
}>;
export class CanonicalProjectWriterReleaseError extends Error {
  override readonly name = "CanonicalProjectWriterReleaseError";
  constructor(
    readonly code: CanonicalProjectWriterReleaseFailureCode,
    options?: ErrorOptions,
  ) {
    super("Canonical Project Writer release failed.", options);
  }
}

export function createCanonicalProjectWriter(
  input: CanonicalProjectWriterInput,
): CanonicalProjectWriter {
  let stage: "fence" | "repository" | "lease" | "closed" = "fence";
  let attempt: Promise<void> | undefined;
  const releaseFence = async (time: string) => {
    if (stage !== "fence") return;
    let result: Awaited<ReturnType<CanonicalCommandRepository["releaseFence"]>>;
    try {
      result = await input.repository.releaseFence(time);
    } catch (cause) {
      throw new CanonicalProjectWriterReleaseError("WRITER_FENCE_RELEASE_FAILED", { cause });
    }
    if (result.status === "stale")
      throw new CanonicalProjectWriterReleaseError("WRITER_FENCE_STALE");
    stage = "repository";
  };
  const closeRepository = async () => {
    if (stage !== "repository") return;
    try {
      await input.repository.close();
    } catch (cause) {
      throw new CanonicalProjectWriterReleaseError("WRITER_REPOSITORY_CLOSE_FAILED", { cause });
    }
    stage = "lease";
  };
  const releaseLease = async () => {
    if (stage !== "lease") return;
    try {
      await input.lease.release();
    } catch (cause) {
      throw new CanonicalProjectWriterReleaseError(
        cause instanceof CanonicalWriterLeaseError ? cause.code : "WRITER_LEASE_CLOSE_FAILED",
        { cause },
      );
    }
    stage = "closed";
  };
  return {
    projectId: input.projectId,
    activationId: input.activationId,
    writerGeneration: input.writerGeneration,
    verifyFence: async () => {
      try {
        return await input.repository.verifyFence();
      } catch {
        return { status: "broken", code: "WRITER_FENCE_CHECK_FAILED" };
      }
    },
    close: (time) => {
      if (attempt !== undefined) return attempt;
      const pending = (async () => {
        await releaseFence(time);
        await closeRepository();
        await releaseLease();
      })();
      attempt = pending;
      void pending.catch(() => {
        if (attempt === pending) attempt = undefined;
      });
      return pending;
    },
  };
}
