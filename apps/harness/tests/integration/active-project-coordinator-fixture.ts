import {
  CanonicalProjectCommandRequestSchema,
  decodeStrict,
  ProjectActivationIdSchema,
  ProjectIdSchema,
  ProjectStorageOpenResultSchema,
  WriterGenerationSchema,
} from "@slopstop/protocol";
import { expect, vi } from "vitest";
import * as coordinators from "../../src/active-project-coordinator.js";
import type { ProjectStorageActivationOutcome } from "../../src/project-storage-application.js";
import {
  type CanonicalCommandRepository,
  type CanonicalCommandRepositoryActivationResult,
  WriterCapabilityTokenSchema,
  type WriterFenceCheck,
} from "../../src/storage/canonical-command-repository.js";
import type { CanonicalWriterLeaseAcquisition } from "../../src/storage/canonical-writer-lease.js";
import { createMigratedSettlement } from "./conformance-counter-command.js";

const projectId = decodeStrict(ProjectIdSchema, "00000000-0000-4000-8000-000000000010");
export const activationId = decodeStrict(
  ProjectActivationIdSchema,
  "00000000-0000-4000-8000-000000000011",
);
export const request = { projectId };
export const command = decodeStrict(CanonicalProjectCommandRequestSchema, {
  projectId,
  activationId,
  command: {
    commandId: "00000000-0000-4000-8000-000000000012",
    type: "conformance.noop",
    version: 1,
    payload: { private: "secret command payload" },
  },
});
export const unavailableMessage = "Canonical Project coordination is unavailable.";
const commandFailures = {
  inactive: ["PROJECT_INACTIVE", "No Project is active for Typed commands.", false],
  "project-mismatch": ["PROJECT_NOT_ACTIVE", "The command Project is not active.", false],
  "stale-activation": ["PROJECT_ACTIVATION_STALE", "The command activation is stale.", false],
  "read-only": ["WRITER_UNAVAILABLE", "The active Project has no write authority.", true],
  "stale-writer": ["WRITER_FENCE_STALE", "The active Writer fence is stale.", false],
  broken: ["WRITER_FENCE_CHECK_FAILED", "The active Writer fence could not be verified.", false],
  "settlement-unavailable": [
    "COMMAND_SETTLEMENT_UNAVAILABLE",
    "Typed-command settlement is not available in this release slice.",
    false,
  ],
  "coordinator-unavailable": ["PROJECT_COORDINATOR_UNAVAILABLE", unavailableMessage, false],
} as const;

export function failure(status: keyof typeof commandFailures, input = command) {
  const [code, message, retryable] = commandFailures[status];
  return {
    status,
    projectId: input.projectId,
    activationId: input.activationId,
    commandId: input.command.commandId,
    diagnostic: { code, message, retryable },
  };
}

function openedResult() {
  const result = decodeStrict(ProjectStorageOpenResultSchema, {
    status: "opened",
    request,
    mode: "read-write",
    identity: {
      storageId: "00000000-0000-4000-8000-000000000013",
      generationId: "00000000-0000-4000-8000-000000000014",
      canonicalDatabaseLineageId: "00000000-0000-4000-8000-000000000015",
      runtimeDatabaseLineageId: "00000000-0000-4000-8000-000000000016",
    },
    canonicalHealth: { status: "healthy" },
    runtimeHealth: { status: "healthy" },
  });
  if (result.status !== "opened") throw new Error("Invalid storage fixture.");
  return result;
}

async function unexpectedSettlement(): Promise<never> {
  throw new Error("Unexpected coordinator lifecycle settlement.");
}

async function activateCoordinatorRepository(
  realCommands: boolean,
  real: ReturnType<typeof createMigratedSettlement>,
  repository: CanonicalCommandRepository,
  input: Parameters<typeof real.activate>[0],
): Promise<CanonicalCommandRepositoryActivationResult> {
  if (!realCommands)
    return { status: "activated", repository, writerGeneration: repository.writerGeneration };
  const result = await real.activate(input);
  return result.status === "activated" ? { ...result, repository } : result;
}

function coordinatorObservations() {
  const calls: string[] = [];
  const faults = new Map<string, unknown>();
  const touch = (stage: string) => {
    calls.push(stage);
    if (faults.has(stage)) {
      const error = faults.get(stage);
      faults.delete(stage);
      throw error;
    }
  };
  return { calls, faults, touch };
}

export function fixture(realCommands = false) {
  const real = createMigratedSettlement(projectId);
  const { calls, faults, touch } = coordinatorObservations();
  const result = openedResult();
  const session = {
    mode: "read-write" as const,
    result,
    canonicalDatabasePath: "active/slopstop.db",
    writerLeasePath: "project/.slopstop-writer.lock",
    close: vi.fn(async () => {
      touch("storage");
      await real.closeStorage();
    }),
  };
  const repository = {
    projectId,
    writerGeneration: decodeStrict(WriterGenerationSchema, 1),
    settle: vi.fn((text: string) => (realCommands ? real.settle(text) : unexpectedSettlement())),
    verifyFence: vi.fn(async (): Promise<WriterFenceCheck> => ({ status: "current" })),
    releaseFence: vi.fn(async (): Promise<WriterFenceCheck> => {
      touch("fence");
      return realCommands ? real.releaseFence("2026-09-05T12:00:04.000Z") : { status: "current" };
    }),
    close: vi.fn(async () => {
      touch("repository");
      await real.close();
    }),
  };
  const lease = { release: vi.fn(async () => touch("lease")) };
  const dependencies = {
    storage: {
      acquireActivation: vi.fn(
        async (): Promise<ProjectStorageActivationOutcome> => ({ status: "ready", session }),
      ),
    },
    leases: {
      acquire: vi.fn(
        async (): Promise<CanonicalWriterLeaseAcquisition> => ({ status: "acquired", lease }),
      ),
    },
    repositories: {
      activate: vi.fn((input: Parameters<typeof real.activate>[0]) =>
        activateCoordinatorRepository(realCommands, real, repository, input),
      ),
    },
    createActivationId: vi.fn(() => activationId),
    createWriterToken: vi.fn(() => decodeStrict(WriterCapabilityTokenSchema, "a".repeat(64))),
    now: () => "2026-09-04T12:00:00.000Z",
  };
  const create = coordinators.createActiveProjectCoordinator;
  expect(create).toBeTypeOf("function");
  if (typeof create !== "function") throw new Error("Coordinator factory is missing.");
  return {
    owner: create(dependencies),
    dependencies,
    session,
    repository,
    lease,
    calls,
    faults,
    touch,
    real,
  };
}
