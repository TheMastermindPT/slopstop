import { ProjectIdSchema, ProjectStorageCreateRequestIdSchema } from "@slopstop/protocol";
import type { ProjectStorageBridgeClient } from "./project-storage-bridge.js";

const healthyProjectId = ProjectIdSchema.parse("00000000-0000-4000-8000-000000000101");
const absentProjectId = ProjectIdSchema.parse("00000000-0000-4000-8000-000000000102");
const witnessProjectId = ProjectIdSchema.parse("00000000-0000-4000-8000-000000000103");
const healthyCreateRequestId = ProjectStorageCreateRequestIdSchema.parse(
  "00000000-0000-4000-8000-000000000111",
);
const witnessCreateRequestId = ProjectStorageCreateRequestIdSchema.parse(
  "00000000-0000-4000-8000-000000000112",
);

export type ProjectStoragePackageSmokeScenario =
  | "bootstrap"
  | "missing-runtime"
  | "witnessed-staging";

export function parseProjectStoragePackageSmokeScenario(
  value: unknown,
): ProjectStoragePackageSmokeScenario {
  switch (value) {
    case "bootstrap":
    case "missing-runtime":
    case "witnessed-staging":
      return value;
    default:
      throw new Error("Invalid packaged Project Storage scenario.");
  }
}

function requireSmoke(condition: boolean): asserts condition {
  if (!condition) {
    throw new Error("Packaged Project Storage smoke failed.");
  }
}

async function runBootstrapScenario(bridge: ProjectStorageBridgeClient): Promise<void> {
  const absent = await bridge.open({ projectId: absentProjectId });
  requireSmoke(absent.status === "not-registered");
  const created = await bridge.create({
    projectId: healthyProjectId,
    createRequestId: healthyCreateRequestId,
  });
  requireSmoke(created.status === "created");
  const healthy = await bridge.open({ projectId: healthyProjectId });
  requireSmoke(healthy.status === "opened");
  requireSmoke(healthy.canonicalHealth.status === "healthy");
  requireSmoke(healthy.runtimeHealth.status === "healthy");
  const closed = await bridge.close({ projectId: healthyProjectId });
  requireSmoke(closed.status === "closed");
}

async function runMissingRuntimeScenario(bridge: ProjectStorageBridgeClient): Promise<void> {
  const safeMode = await bridge.open({ projectId: healthyProjectId });
  requireSmoke(safeMode.status === "safe-mode");
  requireSmoke(safeMode.canonicalHealth.status === "healthy");
  requireSmoke(safeMode.runtimeHealth.status === "missing");
  const closed = await bridge.close({ projectId: healthyProjectId });
  requireSmoke(closed.status === "closed");
}

async function runWitnessedStagingScenario(bridge: ProjectStorageBridgeClient): Promise<void> {
  const witnessOpen = await bridge.open({ projectId: witnessProjectId });
  requireSmoke(witnessOpen.status === "safe-mode");
  requireSmoke(witnessOpen.canonicalHealth.status === "recovery-required");
  requireSmoke(witnessOpen.runtimeHealth.status === "recovery-required");
  const closed = await bridge.close({ projectId: witnessProjectId });
  requireSmoke(closed.status === "closed");
  const witnessCreate = await bridge.create({
    projectId: witnessProjectId,
    createRequestId: witnessCreateRequestId,
  });
  requireSmoke(witnessCreate.status === "blocked");
  requireSmoke(witnessCreate.reason === "prior-state-witness");
}

export async function runProjectStoragePackageSmoke(
  input: Readonly<{
    bridge: ProjectStorageBridgeClient;
    scenario: ProjectStoragePackageSmokeScenario;
  }>,
): Promise<void> {
  switch (input.scenario) {
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
