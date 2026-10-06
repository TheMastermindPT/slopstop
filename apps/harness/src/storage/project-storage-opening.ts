import type {
  OpenedStorageIdentity,
  ProjectDatabaseHealth,
  ProjectStorageOpenRequest,
  ProjectStorageOpenResult,
} from "@slopstop/protocol";
import type { ProjectStorageManifest } from "./project-storage-manifest.js";

export type DatabaseCompatibility = "current" | "known-older" | "newer" | "unknown";
type NullableStorageIdentity = Readonly<{
  storageId: OpenedStorageIdentity["storageId"] | null;
  generationId: OpenedStorageIdentity["generationId"] | null;
  canonicalDatabaseLineageId: OpenedStorageIdentity["canonicalDatabaseLineageId"] | null;
  runtimeDatabaseLineageId: OpenedStorageIdentity["runtimeDatabaseLineageId"] | null;
}>;

type UnregisteredOpeningInspection =
  | Readonly<{ status: "not-registered" }>
  | Readonly<{ status: "recovery-required"; identity: NullableStorageIdentity }>;
type RecoveryOpeningInspection = Extract<
  UnregisteredOpeningInspection,
  { status: "recovery-required" }
>;

export type OpeningInspection<Selection> =
  | UnregisteredOpeningInspection
  | Readonly<{ status: "selected"; selection: Selection }>;

export function recoveryOpeningIdentity(input: {
  registration?: Readonly<{
    storageId: OpenedStorageIdentity["storageId"];
    activeGenerationId: OpenedStorageIdentity["generationId"] | null;
  }>;
  generation?: OpenedStorageIdentity;
}): NullableStorageIdentity {
  return {
    storageId: input.registration?.storageId ?? input.generation?.storageId ?? null,
    generationId: input.registration?.activeGenerationId ?? input.generation?.generationId ?? null,
    canonicalDatabaseLineageId: input.generation?.canonicalDatabaseLineageId ?? null,
    runtimeDatabaseLineageId: input.generation?.runtimeDatabaseLineageId ?? null,
  };
}

export function inspectRegisteredRecovery(input: {
  registration: Readonly<{
    storageId: OpenedStorageIdentity["storageId"];
    activeGenerationId: OpenedStorageIdentity["generationId"] | null;
  }>;
  generations: readonly (OpenedStorageIdentity &
    Readonly<{ creationState: "active" | "staging" }>)[];
  hasFilesystemStaging: boolean;
}): RecoveryOpeningInspection | undefined {
  if (input.registration.activeGenerationId === null) {
    return {
      status: "recovery-required",
      identity: recoveryOpeningIdentity({ registration: input.registration }),
    };
  }
  const matchingGeneration = input.generations.find((generation) =>
    [
      generation.storageId === input.registration.storageId,
      generation.generationId === input.registration.activeGenerationId,
    ].every(Boolean),
  );
  const hasStagingEvidence = [
    input.generations.some((generation) => generation.creationState === "staging"),
    input.hasFilesystemStaging,
  ].some(Boolean);
  if (!hasStagingEvidence) return undefined;
  return {
    status: "recovery-required",
    identity: recoveryOpeningIdentity({
      registration: input.registration,
      ...(matchingGeneration === undefined ? {} : { generation: matchingGeneration }),
    }),
  };
}

export type ProjectDatabaseProbe =
  | Readonly<{ status: "missing" | "unavailable" | "corrupt" | "broken" }>
  | Readonly<{
      status: "present";
      identityMatches: boolean;
      format: DatabaseCompatibility;
      migration: DatabaseCompatibility;
      foreignKeysEnabled: boolean;
      foreignKeyViolationCount: number;
      integrityRows: readonly string[];
      domainInvariantsValid: boolean;
    }>;
type PresentProjectDatabaseProbe = Extract<ProjectDatabaseProbe, { status: "present" }>;
export type ManifestBlockingStatus = Extract<
  ProjectDatabaseHealth["status"],
  "missing" | "unavailable" | "corrupt" | "broken" | "identity-conflict" | "unsupported-newer"
>;

export function presentProjectDatabaseProbe(
  input: Pick<PresentProjectDatabaseProbe, "identityMatches" | "format" | "migration">,
): PresentProjectDatabaseProbe {
  return {
    status: "present",
    ...input,
    foreignKeysEnabled: true,
    foreignKeyViolationCount: 0,
    integrityRows: ["ok"],
    domainInvariantsValid: true,
  };
}

export function compatibilityPrecedesIntegrity(probe: PresentProjectDatabaseProbe): boolean {
  return [
    !probe.identityMatches,
    probe.format === "newer",
    probe.migration === "newer",
    probe.format === "unknown",
    probe.migration === "unknown",
  ].some(Boolean);
}

export type ProjectStorageOpenEvidence =
  | Readonly<{ status: "not-registered" }>
  | Readonly<{
      status: "recovery-required";
      identity: NullableStorageIdentity;
      release(): Promise<void>;
    }>
  | Readonly<{
      status: "selected-blocked";
      identity: OpenedStorageIdentity;
      manifestStatus: ManifestBlockingStatus;
      release(): Promise<void>;
    }>
  | Readonly<{
      status: "selected-current";
      identity: OpenedStorageIdentity;
      canonical: ProjectDatabaseProbe;
      runtime: ProjectDatabaseProbe;
      release(): Promise<void>;
    }>;

export type RetainedProjectStorageSession = Readonly<{
  mode: "read-write" | "safe-mode";
  close(): Promise<void>;
}>;

export type ClassifiedProjectStorageOpening =
  | Readonly<{ result: Extract<ProjectStorageOpenResult, { status: "not-registered" }> }>
  | Readonly<{
      result: Extract<ProjectStorageOpenResult, { status: "opened" }>;
      session: RetainedProjectStorageSession & { mode: "read-write" };
    }>
  | Readonly<{
      result: Extract<ProjectStorageOpenResult, { status: "safe-mode" }>;
      session: RetainedProjectStorageSession & { mode: "safe-mode" };
    }>;

type OpeningDatabaseClient = Readonly<{ close(): Promise<void> }>;
export type OpeningDatabaseClients = Readonly<{
  canonical: OpeningDatabaseClient | undefined;
  runtime: OpeningDatabaseClient | undefined;
}>;

export function inspectUnregisteredOpening(input: {
  registrationCount: number;
  generations: readonly OpenedStorageIdentity[];
  locationCount: number;
  filesystemWitnessCount: number;
}): UnregisteredOpeningInspection | undefined {
  if (input.registrationCount !== 0) return undefined;
  const cleanAbsence = [
    input.generations.length === 0,
    input.locationCount === 0,
    input.filesystemWitnessCount === 0,
  ].every(Boolean);
  if (cleanAbsence) {
    return { status: "not-registered" };
  }
  const generation = input.generations.length === 1 ? input.generations[0] : undefined;
  return {
    status: "recovery-required",
    identity: recoveryOpeningIdentity(generation === undefined ? {} : { generation }),
  };
}

type OpeningDatabaseMetadata = Readonly<{
  formatVersion: number;
  schemaVersion: number;
  lastMigrationId: string;
}>;

function orderedVersionCompatibility(actual: readonly number[]): DatabaseCompatibility {
  if (actual.every((direction) => direction === 0)) return "current";
  if (actual.every((direction) => direction <= 0)) return "known-older";
  if (actual.every((direction) => direction >= 0)) return "newer";
  return "unknown";
}

function knownMigrationCompatibility(input: {
  lastMigrationId: string;
  migrationIds: readonly string[];
}): DatabaseCompatibility {
  const index = input.migrationIds.indexOf(input.lastMigrationId);
  if (index < 0) return "unknown";
  return index === input.migrationIds.length - 1 ? "current" : "known-older";
}

export function openingVersionCompatibility(input: {
  actual: OpeningDatabaseMetadata;
  supported: Readonly<{ formatVersion: number; schemaVersion: number }>;
  migrationIds: readonly string[];
}): Readonly<{ format: DatabaseCompatibility; migration: DatabaseCompatibility }> {
  const directions = [
    Math.sign(input.actual.formatVersion - input.supported.formatVersion),
    Math.sign(input.actual.schemaVersion - input.supported.schemaVersion),
  ];
  const format = orderedVersionCompatibility(directions);
  const migration = knownMigrationCompatibility({
    lastMigrationId: input.actual.lastMigrationId,
    migrationIds: input.migrationIds,
  });
  const contradictory = [
    format === "known-older" && migration === "current",
    format === "newer" && migration === "known-older",
  ].some(Boolean);
  return contradictory ? { format: "unknown", migration: "unknown" } : { format, migration };
}

export function inspectOpeningMetadata(input: {
  actual: OpeningDatabaseMetadata & Readonly<{ metadataKey: string; databaseKind: string }>;
  expected: OpeningDatabaseMetadata;
  supported: Readonly<{
    metadataKey: string;
    databaseKind: string;
    formatVersion: number;
    schemaVersion: number;
  }>;
  migrationIds: readonly string[];
}): Readonly<{ format: DatabaseCompatibility; migration: DatabaseCompatibility }> | undefined {
  const authorityAgrees = [
    input.actual.metadataKey === input.supported.metadataKey,
    input.actual.databaseKind === input.supported.databaseKind,
    openingMetadataAgrees(input.actual, input.expected),
  ].every(Boolean);
  if (!authorityAgrees) return undefined;
  return openingVersionCompatibility(input);
}

export function expectedOpeningMetadata(
  databaseKind: "canonical" | "runtime-adapter",
  manifest: ProjectStorageManifest,
): OpeningDatabaseMetadata {
  return databaseKind === "canonical"
    ? {
        formatVersion: manifest.canonical.formatVersion,
        schemaVersion: manifest.canonical.schemaVersion,
        lastMigrationId: manifest.canonical.lastMigrationId,
      }
    : {
        formatVersion: manifest.runtime.adapterFormatVersion,
        schemaVersion: manifest.runtime.adapterSchemaVersion,
        lastMigrationId: manifest.runtime.adapterLastMigrationId,
      };
}

function openingMetadataAgrees(
  actual: OpeningDatabaseMetadata,
  expected: OpeningDatabaseMetadata,
): boolean {
  return [
    actual.formatVersion === expected.formatVersion,
    actual.schemaVersion === expected.schemaVersion,
    actual.lastMigrationId === expected.lastMigrationId,
  ].every(Boolean);
}

export function openingWithoutApplication(
  filesystemWitnessCount: number,
  release: () => Promise<void>,
): ProjectStorageOpenEvidence {
  if (filesystemWitnessCount === 0) return { status: "not-registered" };
  return {
    status: "recovery-required",
    identity: {
      storageId: null,
      generationId: null,
      canonicalDatabaseLineageId: null,
      runtimeDatabaseLineageId: null,
    },
    release,
  };
}

export async function openingFailureAfterRelease(
  error: unknown,
  release: () => Promise<void>,
): Promise<unknown> {
  try {
    await release();
    return error;
  } catch (releaseError) {
    return new AggregateError([error, releaseError], "Project Storage opening inspection failed.");
  }
}

const failedProbeHealth = {
  missing: {
    status: "missing",
    diagnostic: {
      code: "DATABASE_MISSING",
      message: "Expected database state is missing.",
    },
  },
  unavailable: {
    status: "unavailable",
    diagnostic: {
      code: "DATABASE_UNAVAILABLE",
      message: "Database could not be inspected.",
    },
  },
  corrupt: {
    status: "corrupt",
    diagnostic: {
      code: "DATABASE_CORRUPT",
      message: "Database integrity validation failed.",
    },
  },
  broken: {
    status: "broken",
    diagnostic: {
      code: "DATABASE_BROKEN",
      message: "Database authority is internally inconsistent.",
    },
  },
} as const satisfies Record<
  "missing" | "unavailable" | "corrupt" | "broken",
  ProjectDatabaseHealth
>;

const recoveryRequiredHealth = {
  status: "recovery-required",
  diagnostic: {
    code: "DATABASE_RECOVERY_REQUIRED",
    message: "Database recovery is required.",
  },
} as const satisfies ProjectDatabaseHealth;

const compatibilityHealth = {
  "migration-required": {
    status: "migration-required",
    diagnostic: {
      code: "DATABASE_MIGRATION_REQUIRED",
      message: "Database migration is required.",
    },
  },
  "identity-conflict": {
    status: "identity-conflict",
    diagnostic: {
      code: "DATABASE_IDENTITY_CONFLICT",
      message: "Database identity does not agree.",
    },
  },
  "unsupported-newer": {
    status: "unsupported-newer",
    diagnostic: {
      code: "DATABASE_UNSUPPORTED_NEWER",
      message: "Database version is newer than supported.",
    },
  },
} as const satisfies Record<
  "migration-required" | "identity-conflict" | "unsupported-newer",
  ProjectDatabaseHealth
>;

export function classifyProjectDatabaseProbe(probe: ProjectDatabaseProbe): ProjectDatabaseHealth {
  if (probe.status !== "present") return failedProbeHealth[probe.status];
  if (!probe.identityMatches) return compatibilityHealth["identity-conflict"];
  const compatibilities = [probe.format, probe.migration];
  if (compatibilities.includes("newer")) return compatibilityHealth["unsupported-newer"];
  if (compatibilities.includes("unknown")) return failedProbeHealth.broken;
  if (!probe.foreignKeysEnabled) return failedProbeHealth.broken;
  const corrupt = [
    probe.foreignKeyViolationCount > 0,
    probe.integrityRows.length !== 1,
    probe.integrityRows[0] !== "ok",
    !probe.domainInvariantsValid,
  ].some(Boolean);
  if (corrupt) return failedProbeHealth.corrupt;
  if (compatibilities.includes("known-older")) return compatibilityHealth["migration-required"];
  return { status: "healthy" };
}

async function closeOpeningClients(
  openedClients: OpeningDatabaseClients,
  closed: Record<keyof OpeningDatabaseClients, boolean>,
): Promise<void> {
  const errors: unknown[] = [];
  for (const key of ["canonical", "runtime"] as const) {
    const client = openedClients[key];
    if (client === undefined) continue;
    if (closed[key]) continue;
    try {
      await client.close();
      closed[key] = true;
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) {
    throw new AggregateError(errors, "Project Storage database release failed.");
  }
}

export function createOpeningRelease(openedClients: OpeningDatabaseClients) {
  let releasePromise: Promise<void> | undefined;
  const closed = { canonical: false, runtime: false };
  return (): Promise<void> => {
    if (releasePromise !== undefined) return releasePromise;
    const attempt = closeOpeningClients(openedClients, closed);
    releasePromise = attempt;
    void attempt.catch(() => {
      if (releasePromise === attempt) releasePromise = undefined;
    });
    return attempt;
  };
}

const manifestBlockingHealth = {
  missing: failedProbeHealth.missing,
  unavailable: failedProbeHealth.unavailable,
  corrupt: failedProbeHealth.corrupt,
  broken: failedProbeHealth.broken,
  "identity-conflict": compatibilityHealth["identity-conflict"],
  "unsupported-newer": compatibilityHealth["unsupported-newer"],
} as const satisfies Record<ManifestBlockingStatus, ProjectDatabaseHealth>;

export function classifyProjectStorageOpening(
  request: ProjectStorageOpenRequest,
  evidence: ProjectStorageOpenEvidence,
): ClassifiedProjectStorageOpening {
  if (evidence.status === "not-registered") {
    return { result: { status: "not-registered", request } };
  }
  if (evidence.status === "recovery-required") {
    return {
      result: {
        status: "safe-mode",
        request,
        mode: "safe-mode",
        identity: evidence.identity,
        canonicalHealth: recoveryRequiredHealth,
        runtimeHealth: recoveryRequiredHealth,
      },
      session: { mode: "safe-mode", close: evidence.release },
    };
  }
  if (evidence.status === "selected-blocked") {
    const health = manifestBlockingHealth[evidence.manifestStatus];
    return {
      result: {
        status: "safe-mode",
        request,
        mode: "safe-mode",
        identity: evidence.identity,
        canonicalHealth: health,
        runtimeHealth: health,
      },
      session: { mode: "safe-mode", close: evidence.release },
    };
  }
  const canonicalHealth = classifyProjectDatabaseProbe(evidence.canonical);
  const runtimeHealth = classifyProjectDatabaseProbe(evidence.runtime);
  if (canonicalHealth.status === "healthy" && runtimeHealth.status === "healthy") {
    return {
      result: {
        status: "opened",
        request,
        mode: "read-write",
        identity: evidence.identity,
        canonicalHealth,
        runtimeHealth,
      },
      session: { mode: "read-write", close: evidence.release },
    };
  }
  return {
    result: {
      status: "safe-mode",
      request,
      mode: "safe-mode",
      identity: evidence.identity,
      canonicalHealth,
      runtimeHealth,
    },
    session: { mode: "safe-mode", close: evidence.release },
  };
}
