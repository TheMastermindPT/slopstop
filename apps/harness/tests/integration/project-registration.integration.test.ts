import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decodeStrict } from "@slopstop/protocol";
import { afterEach, describe, expect, it } from "vitest";
import {
  createProjectRegistrationObserver,
  GitVersionInspectionRequestSchema,
  GitVersionInspectionResultSchema,
} from "../../src/project-registration-observer.js";
import { createRegistrationRegistry } from "../../src/registration/registration-registry.js";
import { createWindowsObserverAbsencePort } from "../../src/registration/windows-observer-absence.js";
import { createWindowsVersionChild } from "../../src/registration/windows-version-child.js";
import { createWorkerLocalLibsqlClient } from "../../src/storage/local-libsql-worker-client.js";
import {
  observeRepositoryDirectory,
  observeSelectedExecutable,
} from "../../src/storage/repository-identity-observer.js";
import { createStorageRuntimeForRoot } from "./project-storage-create-fixture.js";
import {
  oldProjectFileHashes,
  restorePreviousRegistryFixture,
  seedGenerationOneCanonical,
} from "./project-storage-historical-fixture.js";
import {
  createHealthyProjectStorageFixture,
  healthyHealth,
  migrationRequiredHealth,
  openedIdentity,
  openRequest,
  payloadOf,
} from "./project-storage-open-fixture.js";
import { switchDeferred } from "./project-storage-runtime-fixture.js";
import { defineIdentityConsentCases } from "./registration-identity-consent-cases.js";
import {
  expectedBoundaryTrace,
  nativeCleanupBoundaries,
  observeCancellationLag,
  observeNativeBoundary,
  observeNativeCompletion,
  observePostResumeCancellation,
  postResumeCancellationCases,
} from "./registration-native-clock-fixture.js";
import {
  nativeTriggerCases,
  observeHeldDeadline,
  observeNativeTrigger,
} from "./registration-native-fault-fixture.js";
import { defineOwnerRecoveryCases } from "./registration-owner-recovery-cases.js";
import { startRegistryPeer } from "./registration-peer-fixture.js";
import { defineRepositoryTrustCases } from "./registration-repository-trust-cases.js";
import {
  createPreviousRegistry,
  expectIndependentUnsettled,
  expectPreservedRegistryRows,
  inconsistentActiveRegistryCases,
  inspectRegistryAfterStatements,
  readPreviousRegistryState,
  seedActiveRegistryGeneration,
  seedMismatchedRegistryGeneration,
} from "./registration-schema-fixture.js";
import {
  createRecordedNativeObserver,
  createRegistryVersionScenario,
  createStoredVersionConsent,
  holdAfterTerminalRecord,
  inspectStoredConsent,
  readObserverRows,
} from "./registration-version-fixture.js";

const migrationResourcesRoot = fileURLToPath(new URL("../../drizzle", import.meta.url));

const admittedConsentId = "fefb33aa-d12b-424a-b87a-6f757cd029a3";
const versionRequest = (consentId: string | null) =>
  decodeStrict(GitVersionInspectionRequestSchema, {
    selectionId: "a728db30-50c9-4aef-a5d6-9a70536314fe",
    consentId,
  });

/** A registration registry over the root with the checked-in migrations. */
function registryAt(root: string) {
  return createRegistrationRegistry({ applicationStorageRoot: root, migrationResourcesRoot });
}

/** Prepares an executable that does not exist under the root. */
function prepareAbsentExecutable(registry: ReturnType<typeof registryAt>, root: string) {
  return registry.prepareExecutable({
    selectionId: versionRequest(null).selectionId,
    executablePath: path.join(root, "absent.exe"),
  });
}

/** The registry refuses as corrupt and leaves its previous state untouched. */
async function expectCorruptRegistryUnchanged(root: string) {
  const before = await readPreviousRegistryState(root);
  const registry = registryAt(root);
  try {
    expect(await prepareAbsentExecutable(registry, root)).toEqual({
      status: "broken",
      code: "REGISTRY_CORRUPT",
    });
    expect(await readPreviousRegistryState(root)).toEqual(before);
  } finally {
    await registry.stop();
  }
}

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

async function createRoot(prefix: string): Promise<string> {
  const parent = path.join(tmpdir(), "opencode");
  await mkdir(parent, { recursive: true });
  const root = await mkdtemp(path.join(parent, prefix));
  roots.push(root);
  return root;
}

async function registryAfterStatements(statements: readonly string[]) {
  return inspectRegistryAfterStatements(await createRoot("pc-s1-registry-fault-"), statements);
}

describe.runIf(process.platform === "win32" && process.arch === "x64")(
  "Project registration native Windows observer",
  () => {
    defineIdentityConsentCases(createRoot);
    defineRepositoryTrustCases(createRoot);
    it.each(postResumeCancellationCases)(
      "NR-1 retains the post-resume cause: $name",
      async (example) => {
        const observed = await observePostResumeCancellation(
          await createRoot("pc-s1-nr1-"),
          example,
        );
        expect({ resumes: observed.resumes, phase: observed.initialEvent }).toEqual({
          resumes: 1,
          phase: "waiting",
        });
        expect(observed).toMatchObject({
          event: "done",
          settledAt: example.causeAt + 5000,
          forcedAt: [example.causeAt + 2000],
          result: {
            status: "pending-recovery",
            code: "OBSERVER_CLEANUP_UNCONFIRMED",
            trigger: example.trigger,
          },
          unsettled: true,
        });
      },
    );

    it.each([2000])(
      "checks the child deadline after native completion at %i",
      async (completedAt) => {
        const root = await createRoot("pc-s1-native-completion-");
        const observed = await observeNativeCompletion(root, completedAt);
        expect(observed.terminalReads).toBeGreaterThan(0);
        expect(observed.event).toBe("done");
        expect(observed.at).toBe(completedAt);
        expect(observed.result).toMatchObject(
          completedAt === 1999
            ? { status: "prepared", version: "2.53.0.windows.1" }
            : { status: "unavailable", code: "OBSERVATION_LIMIT_EXCEEDED" },
        );
        expect(observed.unsettled).toBe(false);
      },
    );

    it.each(nativeCleanupBoundaries)("honors native cleanup boundary: $name", async (example) => {
      const root = await createRoot("pc-s1-native-boundary-");
      const observed = await observeNativeBoundary(root, example);
      if (example.successfulCloseCost !== undefined) expect(observed.successfulClosures).toBe(1);
      expect(observed.trace).toEqual(expectedBoundaryTrace(example));
      expect(observed.at).toBe(2000 + example.finishAt);
      expect(observed.result).toEqual(
        example.confirmed
          ? { status: "unavailable", code: "OBSERVATION_LIMIT_EXCEEDED" }
          : {
              status: "pending-recovery",
              code: "OBSERVER_CLEANUP_UNCONFIRMED",
              trigger: "OBSERVATION_LIMIT_EXCEEDED",
            },
      );
      expect(observed.forceOffsets).toEqual(example.forceOffsets);
      expect(observed.unsettled).toBe(!example.confirmed);
    });

    it("does not restart the cleanup budget after delayed cancellation handling", async () => {
      const root = await createRoot("pc-s1-cancellation-budget-");
      const observed = await observeCancellationLag(root);
      expect(observed.event).toBe("done");
      expect(observed.result).toEqual({
        status: "pending-recovery",
        code: "OBSERVER_CLEANUP_UNCONFIRMED",
        trigger: "CANCELLED",
      });
      expect(observed.close).toEqual({
        status: "pending-recovery",
        code: "OBSERVER_CLEANUP_UNCONFIRMED",
      });
    });

    it.each(nativeTriggerCases)(
      "preserves native $trigger through $fault",
      async (example) => {
        const root = await createRoot("pc-s1-native-trigger-");
        const observed = await observeNativeTrigger(root, example.trigger, example.fault);
        expect(decodeStrict(GitVersionInspectionResultSchema, observed.result)).toEqual(
          observed.result,
        );
        if (example.trigger === "stdout" || example.trigger === "stderr")
          expect(observed.injectedBytes).toBe(8193);
        if (example.fault !== "none") expect(observed.failures).toBeGreaterThan(0);
        expect(observed.result).toEqual(
          example.fault === "none"
            ? { status: "unavailable", code: "OBSERVATION_LIMIT_EXCEEDED" }
            : {
                status: "pending-recovery",
                code: "OBSERVER_CLEANUP_UNCONFIRMED",
                trigger: example.expectedTrigger,
              },
        );
        expect(observed.unsettled).toBe(example.fault !== "none");
        expect(observed.terminals).toHaveLength(example.fault === "none" ? 1 : 0);
        expect(observed.outcomes).toEqual(
          example.fault === "none"
            ? [[JSON.stringify({ status: "unavailable", code: "OBSERVATION_LIMIT_EXCEEDED" })]]
            : [],
        );
      },
      15000,
    );

    it("preserves old Projects while extending the installation registry", async () => {
      const root = await createHealthyProjectStorageFixture();
      await seedGenerationOneCanonical(root);
      restorePreviousRegistryFixture(root);
      const beforeFiles = await oldProjectFileHashes(root);
      const beforeRegistry = await readPreviousRegistryState(root);
      const registry = registryAt(root);
      try {
        expect(await registry.hasUnsettled()).toBe(false);
        const afterRegistry = await readPreviousRegistryState(root);
        expect(afterRegistry.rows.slice(1)).toEqual(beforeRegistry.rows.slice(1));
        expect(await oldProjectFileHashes(root)).toEqual(beforeFiles);
      } finally {
        await registry.stop();
      }
      const runtime = await createStorageRuntimeForRoot(root);
      try {
        expect(payloadOf(await runtime.open(openRequest))).toEqual({
          status: "safe-mode",
          request: openRequest,
          mode: "safe-mode",
          identity: openedIdentity,
          canonicalHealth: migrationRequiredHealth,
          runtimeHealth: healthyHealth,
        });
      } finally {
        await runtime.stop();
      }
      expect(await oldProjectFileHashes(root)).toEqual(beforeFiles);
    });

    it.each(["fresh", "previous"] as const)(
      "preserves version consent across %s registry restart",
      async (initial) => {
        const root = await createRoot("pc-s1-registry-");
        if (initial === "previous") await createPreviousRegistry(root);
        const { registry: first, request } = await createStoredVersionConsent(root);
        await first.stop();

        expect(await inspectStoredConsent(root, request)).toMatchObject({
          status: "prepared",
          selectionId: request.selectionId,
          version: "2.53.0.windows.1",
        });

        await expectPreservedRegistryRows(root, initial);
      },
    );

    it("observes a local directory by its lossless native lifetime identity", async () => {
      const root = await createRoot("pc-s1-identity-");
      const directory = path.join(root, "repository");
      await mkdir(directory);

      const observed = await observeRepositoryDirectory(directory);
      expect(observed.status).toBe("observed");
      if (observed.status !== "observed") throw new Error("Directory was not observed");
      const reference = await stat(directory, { bigint: true });
      expect(observed.key).toEqual({
        version: "physical-directory/v1",
        platform: "win32",
        volumeIdentity: expect.stringMatching(/^[1-9][0-9]*$/),
        fileIdentity: String(reference.ino),
        birthIdentity: String(reference.birthtimeNs),
      });
      expect(await observeRepositoryDirectory(directory.toUpperCase())).toEqual(observed);
      const moved = path.join(root, "moved");
      await rename(directory, moved);
      expect(await observeRepositoryDirectory(moved)).toEqual(observed);
      await mkdir(directory);
      const replacement = await observeRepositoryDirectory(directory);
      expect(replacement.status).toBe("observed");
      expect(replacement).not.toEqual(observed);
    });

    it("inspects the admitted installed Git version through the owned native child", async () => {
      const root = await createRoot("pc-s1-version-");
      const request = versionRequest(admittedConsentId);
      const expected = decodeStrict(GitVersionInspectionResultSchema, {
        status: "prepared",
        selectionId: request.selectionId,
        observationId: "c42caec7-06c4-49bd-9a34-e5b034ab2477",
        version: "2.53.0.windows.1",
      });
      if (expected.status !== "prepared") throw new Error("Invalid test version observation");
      const { observer, journal, owned } = await createRecordedNativeObserver(
        root,
        expected.observationId,
      );

      expect(await observer.inspectGitVersion(request)).toEqual(expected);
      expect(journal).toEqual(["intent", "owned", "validated"]);
      expect(owned).toHaveLength(1);
      expect(owned[0]).toMatchObject({
        platform: "win32",
        jobName: `Local\\SlopStop.Registration.Observer.${expected.observationId}`,
      });
      expect(owned[0]?.creationTime100ns).toMatch(/^[1-9][0-9]*$/);
    });

    it("reports a missing physical repository location without fabricating identity", async () => {
      const root = await createRoot("pc-s1-missing-");
      expect(await observeRepositoryDirectory(path.join(root, "absent"))).toEqual({
        status: "rejected",
        code: "REPOSITORY_NOT_FOUND",
      });
    });

    it("reads the selected executable's physical identity and complete digest", async () => {
      const location = path.join(
        process.env["ProgramFiles"] ?? "C:/Program Files",
        "Git/cmd/git.exe",
      );
      const observed = await observeSelectedExecutable(location);
      expect(observed.status).toBe("observed");
      if (observed.status !== "observed") throw new Error("Executable was not observed");
      const reference = await stat(location, { bigint: true });
      const digest = createHash("sha256")
        .update(await readFile(location))
        .digest("hex");
      expect(observed.identity).toEqual({
        platform: "win32",
        volumeIdentity: expect.stringMatching(/^[1-9][0-9]*$/),
        fileIdentity: String(reference.ino),
        birthIdentity: String(reference.birthtimeNs),
        sha256: digest,
      });
    });

    it("refuses an unknown registry head before observing the selected executable", async () => {
      const result = await registryAfterStatements([
        "UPDATE schema_metadata SET last_migration_id = 'unknown-head'",
      ]);
      expect(result.outcome).toEqual({ status: "broken", code: "REGISTRY_SCHEMA_UNKNOWN" });
    });

    it.each(["format_version", "schema_version"] as const)(
      "classifies newer %s before an unknown head",
      async (column) => {
        const result = await registryAfterStatements([
          `UPDATE schema_metadata SET ${column} = 2, last_migration_id = 'unknown-head'`,
        ]);
        expect(result.outcome).toEqual({ status: "broken", code: "REGISTRY_SCHEMA_NEWER" });
      },
    );

    it("classifies corrupt metadata before newer versions and unknown heads", async () => {
      const result = await registryAfterStatements([
        "PRAGMA ignore_check_constraints = ON",
        "UPDATE schema_metadata SET database_kind = 'canonical', format_version = 2, last_migration_id = 'unknown-head'",
      ]);
      expect(result.outcome).toEqual({ status: "broken", code: "REGISTRY_CORRUPT" });
    });

    it("preserves a missing registry's witness instead of initializing defaults", async () => {
      const root = await createRoot("pc-s1-registry-witness-");
      const witness = path.join(root, "application.db-wal");
      await writeFile(witness, "prior-registry-witness");
      const registry = registryAt(root);
      try {
        expect(await prepareAbsentExecutable(registry, root)).toEqual({
          status: "pending-recovery",
          code: "REGISTRY_MISSING_WITH_WITNESS",
        });
        expect(await readFile(witness, "utf8")).toBe("prior-registry-witness");
        await expect(stat(path.join(root, "application.db"))).rejects.toMatchObject({
          code: "ENOENT",
        });
      } finally {
        await registry.stop();
      }
    });

    it.each([
      "ALTER TABLE storage_registrations ADD COLUMN extra TEXT",
      "CREATE TABLE extra (value TEXT)",
      "CREATE VIEW extra AS SELECT project_id FROM storage_registrations",
      "CREATE INDEX extra ON storage_registrations (project_id)",
      "CREATE TRIGGER extra BEFORE UPDATE ON schema_metadata BEGIN SELECT RAISE(ABORT, 'unexpected update'); END",
    ])("refuses undeclared previous-schema structure: %s", async (mutation) => {
      const root = await createRoot("pc-s1-schema-drift-");
      await createPreviousRegistry(root);
      const edit = createWorkerLocalLibsqlClient(path.join(root, "application.db"), "application");
      try {
        await edit.execute(mutation);
      } finally {
        await edit.close();
      }
      const registry = registryAt(root);
      try {
        expect(await prepareAbsentExecutable(registry, root)).toEqual({
          status: "broken",
          code: "REGISTRY_CORRUPT",
        });
      } finally {
        await registry.stop();
      }
      const check = createWorkerLocalLibsqlClient(path.join(root, "application.db"), "application");
      try {
        expect((await check.execute("SELECT last_migration_id FROM schema_metadata")).rows).toEqual(
          [["0000_gray_eddie_brock"]],
        );
        expect(
          (
            await check.execute(
              "SELECT name FROM sqlite_schema WHERE name = 'registration_executable_selections'",
            )
          ).rows,
        ).toEqual([]);
      } finally {
        await check.close();
      }
    });

    it("reports registry contention instead of treating it as broken or empty", async () => {
      const root = await createRoot("pc-s1-registry-busy-");
      await createPreviousRegistry(root);
      const locker = createWorkerLocalLibsqlClient(
        path.join(root, "application.db"),
        "application",
      );
      const held = await locker.transaction("write");
      const registry = registryAt(root);
      try {
        expect(await prepareAbsentExecutable(registry, root)).toEqual({
          status: "unavailable",
          code: "REGISTRY_BUSY",
        });
      } finally {
        await held.rollback();
        await held.close();
        await locker.close();
        await registry.stop();
      }
    });

    it("rejects malformed metadata without coercing null into an older version", async () => {
      const result = await registryAfterStatements([
        "DROP TABLE schema_metadata",
        "CREATE TABLE schema_metadata (metadata_key TEXT PRIMARY KEY, database_kind TEXT, format_version INTEGER, schema_version INTEGER, last_migration_id TEXT)",
        "INSERT INTO schema_metadata VALUES ('application', 'application', NULL, 1, 'unknown-head')",
      ]);
      expect(result.outcome).toEqual({ status: "broken", code: "REGISTRY_CORRUPT" });
    });

    it("replays a version consent without rewriting its decision", async () => {
      const root = await createRoot("pc-s1-consent-replay-");
      const registry = registryAt(root);
      const request = versionRequest(admittedConsentId);
      if (request.consentId === null) throw new Error("Test consent missing");
      const decision = {
        selectionId: request.selectionId,
        consentId: request.consentId,
        decision: "accepted" as const,
      };
      try {
        expect(
          await registry.prepareExecutable({
            selectionId: request.selectionId,
            executablePath: path.join(
              process.env["ProgramFiles"] ?? "C:/Program Files",
              "Git/cmd/git.exe",
            ),
          }),
        ).toMatchObject({ status: "prepared" });
        expect(await registry.decideVersion(decision)).toEqual({ status: "recorded" });
        const check = createWorkerLocalLibsqlClient(
          path.join(root, "application.db"),
          "application",
        );
        try {
          const before = (await check.execute("SELECT * FROM registration_version_consents")).rows;
          expect(await registry.decideVersion(decision)).toEqual({ status: "recorded" });
          expect((await check.execute("SELECT * FROM registration_version_consents")).rows).toEqual(
            before,
          );
        } finally {
          await check.close();
        }
      } finally {
        await registry.stop();
      }
    });

    it("rejects changed consent content before looking up another executable selection", async () => {
      const root = await createRoot("pc-s1-consent-conflict-");
      const registry = registryAt(root);
      const request = versionRequest(admittedConsentId);
      if (request.consentId === null) throw new Error("Test consent missing");
      try {
        expect(
          await registry.prepareExecutable({
            selectionId: request.selectionId,
            executablePath: path.join(
              process.env["ProgramFiles"] ?? "C:/Program Files",
              "Git/cmd/git.exe",
            ),
          }),
        ).toMatchObject({ status: "prepared" });
        expect(
          await registry.decideVersion({
            ...request,
            consentId: request.consentId,
            decision: "accepted",
          }),
        ).toEqual({ status: "recorded" });
        const other = decodeStrict(GitVersionInspectionRequestSchema, {
          ...request,
          selectionId: "6396df9a-6d5c-44c3-b77c-8f20f9a63626",
        });
        expect(
          await registry.decideVersion({
            ...other,
            consentId: request.consentId,
            decision: "accepted",
          }),
        ).toEqual({
          status: "rejected",
          code: "REGISTRATION_IDEMPOTENCY_CONFLICT",
        });
        expect(
          await registry.decideVersion({
            ...request,
            consentId: request.consentId,
            decision: "accepted",
          }),
        ).toEqual({ status: "recorded" });
      } finally {
        await registry.stop();
      }
    });

    it.each(["before-ddl", "after-ddl", "before-metadata", "before-commit"] as const)(
      "rolls back the registry extension at %s",
      async (failurePoint) => {
        const root = await createRoot("pc-s1-migration-rollback-");
        await createPreviousRegistry(root);
        const registry = createRegistrationRegistry({
          applicationStorageRoot: root,
          migrationResourcesRoot,
          failures: {
            checkpoint: async (point) => {
              if (point === failurePoint) throw new Error("Injected registry migration failure");
            },
          },
        });
        try {
          const request = versionRequest(null);
          expect(
            await registry.prepareExecutable({
              selectionId: request.selectionId,
              executablePath: path.join(
                process.env["ProgramFiles"] ?? "C:/Program Files",
                "Git/cmd/git.exe",
              ),
            }),
          ).toEqual({ status: "broken", code: "INTERNAL_FAILURE" });
        } finally {
          await registry.stop();
        }
        const check = createWorkerLocalLibsqlClient(
          path.join(root, "application.db"),
          "application",
        );
        try {
          expect(
            (await check.execute("SELECT last_migration_id FROM schema_metadata")).rows,
          ).toEqual([["0000_gray_eddie_brock"]]);
          expect(
            (
              await check.execute(
                "SELECT name FROM sqlite_schema WHERE name = 'registration_executable_selections'",
              )
            ).rows,
          ).toEqual([]);
          expect(
            (await check.execute("SELECT project_id FROM storage_registrations")).rows,
          ).toEqual([["71938cf7-9874-4dd8-8f10-7507a8ef9a82"]]);
        } finally {
          await check.close();
        }
      },
    );

    it("reconciles a lost migration commit acknowledgement without replaying DDL", async () => {
      const root = await createRoot("pc-s1-migration-uncertain-");
      await createPreviousRegistry(root);
      const attempts: string[] = [];
      const registry = createRegistrationRegistry({
        applicationStorageRoot: root,
        migrationResourcesRoot,
        failures: {
          checkpoint: async (point) => {
            attempts.push(point);
            if (point === "commit-acknowledgement")
              throw new Error("Injected lost commit acknowledgement");
          },
        },
      });
      try {
        const request = versionRequest(null);
        const outcome = await registry.prepareExecutable({
          selectionId: request.selectionId,
          executablePath: path.join(
            process.env["ProgramFiles"] ?? "C:/Program Files",
            "Git/cmd/git.exe",
          ),
        });
        const check = createWorkerLocalLibsqlClient(
          path.join(root, "application.db"),
          "application",
        );
        try {
          expect(
            (await check.execute("SELECT last_migration_id FROM schema_metadata")).rows,
          ).toEqual([["0007_storage_upgrades"]]);
        } finally {
          await check.close();
        }
        expect(outcome).toEqual({ status: "prepared", selectionId: request.selectionId });
        expect(attempts.filter((point) => point === "before-ddl")).toHaveLength(1);
        expect(attempts.filter((point) => point === "commit-acknowledgement")).toHaveLength(1);
      } finally {
        await registry.stop();
      }
    });

    it.each(["previous", "current"] as const)(
      "rejects inconsistent Project relationships across the %s registry",
      async (head) => {
        const root = await createRoot("pc-s1-registry-relationships-");
        await createPreviousRegistry(root);
        if (head === "current") await expectIndependentUnsettled(root, false);
        await seedMismatchedRegistryGeneration(root);
        await expectCorruptRegistryUnchanged(root);
      },
    );

    it.each(inconsistentActiveRegistryCases)(
      "rejects an inconsistent active registry relationship: %s",
      async (_name, mutation) => {
        const root = await createRoot("pc-s1-active-relationship-");
        await createPreviousRegistry(root);
        await seedActiveRegistryGeneration(root);
        const edit = createWorkerLocalLibsqlClient(
          path.join(root, "application.db"),
          "application",
        );
        try {
          await edit.execute(mutation);
          expect((await edit.execute("PRAGMA foreign_key_check")).rows).toEqual([]);
        } finally {
          await edit.close();
        }
        await expectCorruptRegistryUnchanged(root);
      },
    );

    it("preserves the exact previous registry after uncertain uncommitted migration", async () => {
      const root = await createRoot("pc-s1-uncommitted-registry-");
      await createPreviousRegistry(root);
      const before = await readPreviousRegistryState(root);
      const attempts: string[] = [];
      const registry = createRegistrationRegistry({
        applicationStorageRoot: root,
        migrationResourcesRoot,
        failures: {
          checkpoint: async (point) => {
            attempts.push(point);
            if (point === "commit-before-boundary") throw new Error("Commit not acknowledged");
          },
        },
      });
      try {
        expect(await prepareAbsentExecutable(registry, root)).toEqual({
          status: "broken",
          code: "INTERNAL_FAILURE",
        });
        expect(await readPreviousRegistryState(root)).toEqual(before);
        expect(attempts.filter((point) => point === "before-ddl")).toHaveLength(1);
        expect(attempts.filter((point) => point === "commit-before-boundary")).toHaveLength(1);
      } finally {
        await registry.stop();
      }
    });

    it("settles proven no-dispatch capability refusal without inventing child exit", async () => {
      const root = await createRoot("pc-s1-no-dispatch-");
      let admissions = 0;
      const { registry, observer, request } = await createRegistryVersionScenario(root, {
        run: async () => {
          admissions += 1;
          return { status: "unavailable", code: "GIT_UNAVAILABLE" };
        },
      });
      try {
        const expected = { status: "unavailable", code: "GIT_UNAVAILABLE" };
        expect(await observer.inspectGitVersion(request)).toEqual(expected);
        expect(await registry.hasUnsettled()).toBe(false);
        expect(await observer.inspectGitVersion(request)).toEqual(expected);
        expect(admissions).toBe(1);
        expect(await readObserverRows(root, "children")).toEqual([]);
        expect(await readObserverRows(root, "terminals")).toEqual([]);
      } finally {
        await registry.stop();
      }
      await expectIndependentUnsettled(root, false);
    });

    it.each([false, true])(
      "retains uncertain dispatch across restart with child identity=%s",
      async (hasIdentity) => {
        const root = await createRoot("pc-s1-uncertain-dispatch-");
        let admissions = 0;
        const { registry, observer, request } = await createRegistryVersionScenario(root, {
          run: async (dispatch) => {
            admissions += 1;
            if (hasIdentity)
              await dispatch.onOwned({
                platform: "win32",
                processId: 1234,
                creationTime100ns: "134000000000000000",
                jobName: `Local\\SlopStop.Registration.Observer.${dispatch.observationId}`,
              });
            throw new Error("private-uncertain-start-canary");
          },
        });
        try {
          expect(await observer.inspectGitVersion(request)).toEqual({
            status: "pending-recovery",
            code: "OBSERVER_CLEANUP_UNCONFIRMED",
            trigger: "INTERNAL_FAILURE",
          });
          expect(await registry.hasUnsettled()).toBe(true);
        } finally {
          await registry.stop();
        }
        const reopened = registryAt(root);
        try {
          const restarted = createProjectRegistrationObserver(
            {
              inspect: async () => {
                admissions += 1;
                return { status: "unavailable", code: "GIT_UNAVAILABLE" };
              },
            },
            reopened,
          );
          expect(await restarted.inspectGitVersion(request)).toEqual({
            status: "pending-recovery",
            code: "OBSERVER_CLEANUP_UNCONFIRMED",
          });
          expect(admissions).toBe(1);
        } finally {
          await reopened.stop();
        }
      },
    );

    it("cancels a durable intent before child dispatch when close wins admission", async () => {
      const root = await createRoot("pc-s1-intent-close-");
      const release = switchDeferred<void>();
      const intentStored = switchDeferred<void>();
      let dispatches = 0;
      const { registry, observer, request } = await createRegistryVersionScenario(
        root,
        {
          run: async () => {
            dispatches += 1;
            return { status: "unavailable", code: "GIT_UNAVAILABLE" };
          },
        },
        (journal) => ({
          ...journal,
          begin: async (dispatch) => {
            const result = await journal.begin(dispatch);
            intentStored.resolve();
            await release.promise;
            return result;
          },
        }),
      );
      const observation = observer.inspectGitVersion(request);
      try {
        await intentStored.promise;
        const closing = observer.close();
        release.resolve();
        expect(await observation).toEqual({ status: "cancelled" });
        expect(await closing).toEqual({ status: "closed" });
        expect(dispatches).toBe(0);
        expect(await registry.hasUnsettled()).toBe(false);
      } finally {
        release.resolve();
        await observation;
        await registry.stop();
      }
    });

    it("reconciles durable native terminal proof and fences the former publisher", async () => {
      const root = await createRoot("pc-s1-terminal-reconciliation-");
      const { release, terminalStored, journalFor } = holdAfterTerminalRecord();
      const { registry, observer, request } = await createRegistryVersionScenario(
        root,
        createWindowsVersionChild(root),
        journalFor,
      );
      const observation = observer.inspectGitVersion(request);
      const guard = setTimeout(() => release.resolve(), 8000);
      const restarted = registryAt(root);
      try {
        await terminalStored.promise;
        expect(await restarted.hasUnsettled()).toBe(true);
        expect(await restarted.reconcileObservers()).toEqual({ status: "settled" });
        expect(await restarted.hasUnsettled()).toBe(false);
        release.resolve();
        expect(await observation).not.toMatchObject({ status: "prepared" });
        expect(await restarted.reconcileObservers()).toEqual({ status: "settled" });
        expect(await readObserverRows(root, "outcomes")).toEqual([
          [JSON.stringify({ status: "broken", code: "INTERNAL_FAILURE" })],
        ]);
      } finally {
        clearTimeout(guard);
        release.resolve();
        await observation;
        await registry.stop();
        await restarted.stop();
      }
    }, 12000);

    defineOwnerRecoveryCases(createRoot);

    it("reconciles an exact absent native owner after terminal publication is lost", async () => {
      const root = await createRoot("pc-s1-native-absence-");
      const native = createWindowsVersionChild(root);
      const { registry, observer, request } = await createRegistryVersionScenario(root, {
        run: async (dispatch, signal) => {
          await native.run(dispatch, signal);
          throw new Error("Lost native terminal publication");
        },
      });
      try {
        expect(await observer.inspectGitVersion(request)).toEqual({
          status: "pending-recovery",
          code: "OBSERVER_CLEANUP_UNCONFIRMED",
          trigger: "INTERNAL_FAILURE",
        });
      } finally {
        await registry.stop();
      }
      const restarted = registryAt(root);
      try {
        expect(await restarted.reconcileObservers(createWindowsObserverAbsencePort())).toEqual({
          status: "settled",
        });
        expect(await restarted.hasUnsettled()).toBe(false);
        expect(await readObserverRows(root, "terminals")).toEqual([]);
        expect(await readObserverRows(root, "outcomes")).toEqual([
          [
            JSON.stringify({
              status: "broken",
              code: "INTERNAL_FAILURE",
              reconciliation: "exact-owner-absence",
            }),
          ],
        ]);
      } finally {
        await restarted.stop();
      }
    });

    it("never persists a late successful version after the observer has closed", async () => {
      const root = await createRoot("pc-s1-late-publication-");
      const release = switchDeferred<void>();
      const owned = switchDeferred<void>();
      const { registry, observer, request } = await createRegistryVersionScenario(root, {
        run: async (dispatch) => {
          await dispatch.onOwned({
            platform: "win32",
            processId: 1234,
            creationTime100ns: "134000000000000000",
            jobName: `Local\\SlopStop.Registration.Observer.${dispatch.observationId}`,
          });
          owned.resolve();
          await release.promise;
          return {
            status: "exited",
            exitCode: 0,
            stdout: new TextEncoder().encode("git version 2.53.0.windows.1\n"),
            stderr: new Uint8Array(),
          };
        },
      });
      const observation = observer.inspectGitVersion(request);
      try {
        await owned.promise;
        expect(await observer.close()).toEqual({
          status: "pending-recovery",
          code: "OBSERVER_CLEANUP_UNCONFIRMED",
        });
        release.resolve();
        expect(await observation).toEqual({ status: "cancelled" });
        expect(await readObserverRows(root, "outcomes")).toEqual([
          [JSON.stringify({ status: "cancelled" })],
        ]);
      } finally {
        release.resolve();
        await observation;
        await registry.stop();
      }
    }, 10000);

    it("settles a native observer deadline while child ownership publication is held", async () => {
      const root = await createRoot("pc-s1-native-deadline-");
      const observed = await observeHeldDeadline(root);
      expect(observed.result).toEqual({
        status: "unavailable",
        code: "OBSERVATION_LIMIT_EXCEEDED",
      });
      expect(observed.unsettled).toBe(false);
      expect(observed.settledResult).toEqual(observed.result);
      expect(observed.subsequent).toEqual(observed.result);
    }, 15000);

    it("preserves the deadline trigger when native cleanup cannot be proved", async () => {
      const root = await createRoot("pc-s1-cleanup-failure-");
      const observed = await observeNativeTrigger(root, "deadline", "job-query");
      expect(observed.result).toEqual({
        status: "pending-recovery",
        code: "OBSERVER_CLEANUP_UNCONFIRMED",
        trigger: "OBSERVATION_LIMIT_EXCEEDED",
      });
      expect(observed.unsettled).toBe(true);
      expect(observed.subsequent).toEqual({
        status: "pending-recovery",
        code: "OBSERVER_CLEANUP_UNCONFIRMED",
      });
    });

    it("cancels an owned native observation on close without publishing late output", async () => {
      const root = await createRoot("pc-s1-native-close-");
      const observed = await observeNativeTrigger(root, "cancellation", "none");
      expect(observed.close).toEqual({ status: "closed" });
      expect(observed.result).toEqual({ status: "cancelled" });
      expect(observed.subsequent).toEqual({ status: "cancelled" });
      expect(observed.unsettled).toBe(false);
      await expectIndependentUnsettled(root, false);
    }, 15000);

    it("persists observer intent before native dispatch and terminal proof before publication", async () => {
      const root = await createRoot("pc-s1-durable-observer-");
      let dispatches = 0;
      const native = createWindowsVersionChild(root);
      const { registry, observer, request } = await createRegistryVersionScenario(root, {
        run: async (dispatch, signal) => {
          dispatches += 1;
          await expectIndependentUnsettled(root, true);
          return native.run(dispatch, signal);
        },
      });
      try {
        const result = await observer.inspectGitVersion(request);
        expect(result).toMatchObject({
          status: "prepared",
          selectionId: request.selectionId,
          version: "2.53.0.windows.1",
        });
        expect(await registry.hasUnsettled()).toBe(false);
        expect(await observer.inspectGitVersion(request)).toEqual(result);
        expect(dispatches).toBe(1);
      } finally {
        await registry.stop();
      }
      await expectIndependentUnsettled(root, false);
    });

    it("holds registry write exclusion across independent-process migration and retry", async () => {
      const root = await createRoot("pc-s1-registry-peers-");
      await createPreviousRegistry(root);
      const first = await startRegistryPeer(root, migrationResourcesRoot, true);
      const second = await startRegistryPeer(root, migrationResourcesRoot);
      const executablePath = path.join(
        process.env["ProgramFiles"] ?? "C:/Program Files",
        "Git/cmd/git.exe",
      );
      try {
        first.send({
          kind: "prepare",
          selectionId: "a728db30-50c9-4aef-a5d6-9a70536314fe",
          executablePath,
        });
        await first.next("locked");
        second.send({
          kind: "prepare",
          selectionId: "6396df9a-6d5c-44c3-b77c-8f20f9a63626",
          executablePath,
        });
        expect(await second.next("result")).toEqual({
          kind: "result",
          outcome: { status: "unavailable", code: "REGISTRY_BUSY" },
        });
        first.send({ kind: "release" });
        expect(await first.next("result")).toMatchObject({
          kind: "result",
          outcome: { status: "prepared" },
        });
        second.send({
          kind: "prepare",
          selectionId: "6396df9a-6d5c-44c3-b77c-8f20f9a63626",
          executablePath,
        });
        expect(await second.next("result")).toMatchObject({
          kind: "result",
          outcome: { status: "prepared" },
        });
        expect(first.messages.filter((message) => message.kind === "migration")).toHaveLength(1);
        expect(second.messages.filter((message) => message.kind === "migration")).toHaveLength(0);
      } finally {
        first.send({ kind: "release" });
        await first.stop();
        await second.stop();
      }
    });
  },
);
