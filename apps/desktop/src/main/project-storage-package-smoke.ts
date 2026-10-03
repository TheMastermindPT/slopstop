import {
  decodeStrict,
  writerProofProjectId as healthyProjectId,
  ProjectIdSchema,
  ProjectStorageCreateRequestIdSchema,
} from "@slopstop/protocol";
import type { ProjectStorageBridgeClient } from "./project-storage-bridge.js";

const absentProjectId = decodeStrict(ProjectIdSchema, "00000000-0000-4000-8000-000000000102");
const witnessProjectId = decodeStrict(ProjectIdSchema, "00000000-0000-4000-8000-000000000103");
const healthyCreateRequestId = decodeStrict(
  ProjectStorageCreateRequestIdSchema,
  "00000000-0000-4000-8000-000000000111",
);
const witnessCreateRequestId = decodeStrict(
  ProjectStorageCreateRequestIdSchema,
  "00000000-0000-4000-8000-000000000112",
);

export type ProjectStoragePackageSmokeScenario =
  | "bootstrap"
  | "writer-proof"
  | "missing-runtime"
  | "witnessed-staging";

type ProjectStoragePackageSmokeFailureStage =
  | "absent-project-open"
  | "healthy-project-create"
  | "healthy-project-open"
  | "healthy-canonical-health"
  | "healthy-runtime-health"
  | "healthy-project-close"
  | "missing-runtime-open"
  | "missing-runtime-canonical-health"
  | "missing-runtime-health"
  | "missing-runtime-close"
  | "witness-project-open"
  | "witness-canonical-health"
  | "witness-runtime-health"
  | "witness-project-close"
  | "witness-project-create"
  | "witness-create-reason";

class ProjectStoragePackageSmokeError extends Error {
  override readonly name = "ProjectStoragePackageSmokeError";

  constructor(readonly stage: ProjectStoragePackageSmokeFailureStage) {
    super("Packaged Project Storage smoke failed.");
  }
}

export function parseProjectStoragePackageSmokeScenario(
  value: unknown,
): ProjectStoragePackageSmokeScenario {
  switch (value) {
    case "bootstrap":
    case "writer-proof":
    case "missing-runtime":
    case "witnessed-staging":
      return value;
    default:
      throw new Error("Invalid packaged Project Storage scenario.");
  }
}

function requireSmoke(
  condition: boolean,
  stage: ProjectStoragePackageSmokeFailureStage,
): asserts condition {
  if (!condition) {
    throw new ProjectStoragePackageSmokeError(stage);
  }
}

export function projectStoragePackageSmokeFailureStage(
  error: unknown,
): ProjectStoragePackageSmokeFailureStage | undefined {
  return error instanceof ProjectStoragePackageSmokeError ? error.stage : undefined;
}

async function runBootstrapScenario(bridge: ProjectStorageBridgeClient): Promise<void> {
  const absent = await bridge.open({ projectId: absentProjectId });
  requireSmoke(absent.status === "not-registered", "absent-project-open");
  const created = await bridge.create({
    projectId: healthyProjectId,
    createRequestId: healthyCreateRequestId,
  });
  requireSmoke(created.status === "created", "healthy-project-create");
  const healthy = await bridge.open({ projectId: healthyProjectId });
  requireSmoke(healthy.status === "opened", "healthy-project-open");
  requireSmoke(healthy.canonicalHealth.status === "healthy", "healthy-canonical-health");
  requireSmoke(healthy.runtimeHealth.status === "healthy", "healthy-runtime-health");
  const closed = await bridge.close({ projectId: healthyProjectId });
  requireSmoke(closed.status === "closed", "healthy-project-close");
}

async function runMissingRuntimeScenario(bridge: ProjectStorageBridgeClient): Promise<void> {
  const safeMode = await bridge.open({ projectId: healthyProjectId });
  requireSmoke(safeMode.status === "safe-mode", "missing-runtime-open");
  requireSmoke(safeMode.canonicalHealth.status === "healthy", "missing-runtime-canonical-health");
  requireSmoke(safeMode.runtimeHealth.status === "missing", "missing-runtime-health");
  const closed = await bridge.close({ projectId: healthyProjectId });
  requireSmoke(closed.status === "closed", "missing-runtime-close");
}

async function runWitnessedStagingScenario(bridge: ProjectStorageBridgeClient): Promise<void> {
  const witnessOpen = await bridge.open({ projectId: witnessProjectId });
  requireSmoke(witnessOpen.status === "safe-mode", "witness-project-open");
  requireSmoke(
    witnessOpen.canonicalHealth.status === "recovery-required",
    "witness-canonical-health",
  );
  requireSmoke(witnessOpen.runtimeHealth.status === "recovery-required", "witness-runtime-health");
  const closed = await bridge.close({ projectId: witnessProjectId });
  requireSmoke(closed.status === "closed", "witness-project-close");
  const witnessCreate = await bridge.create({
    projectId: witnessProjectId,
    createRequestId: witnessCreateRequestId,
  });
  requireSmoke(witnessCreate.status === "blocked", "witness-project-create");
  requireSmoke(witnessCreate.reason === "prior-state-witness", "witness-create-reason");
}

export async function runProjectStoragePackageSmoke(
  input: Readonly<{
    bridge: ProjectStorageBridgeClient;
    scenario: ProjectStoragePackageSmokeScenario;
  }>,
): Promise<void> {
  switch (input.scenario) {
    case "writer-proof":
      throw new Error("Writer proof requires the private process owner.");
    case "bootstrap":
      await runBootstrapScenario(input.bridge);
      return;
    case "missing-runtime":
      await runMissingRuntimeScenario(input.bridge);
      return;
    case "witnessed-staging":
      await runWitnessedStagingScenario(input.bridge);
  }
}
