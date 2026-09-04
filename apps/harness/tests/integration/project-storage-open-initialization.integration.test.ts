import { ProjectStorageOpenRequestSchema } from "@slopstop/protocol";
import { expect, it, vi } from "vitest";
import type { LocalLibsqlClient } from "../../src/storage/local-libsql-worker-client.js";
import { createNodeProjectStorageDependencies } from "../../src/storage/project-storage-node-adapters.js";
import type { ProjectStorageOpenEvidence } from "../../src/storage/project-storage-opening.js";
import {
  checkedInMigrationRoot,
  projectStorageIntegrationTimeout,
} from "./project-storage-create-fixture.js";
import {
  createHealthyProjectStorageFixture,
  expectNotToExpose,
  openRequest,
} from "./project-storage-open-fixture.js";

function required<Value>(value: Value | undefined, message: string): Value {
  if (value === undefined) throw new Error(message);
  return value;
}

function deferred(): Readonly<{ promise: Promise<void>; resolve(): void }> {
  let complete: (() => void) | undefined;
  const promise = new Promise<void>((resolve) => {
    complete = resolve;
  });
  return {
    promise,
    resolve: required(complete, "Deferred operation resolver is unavailable."),
  };
}

function observeClose(client: LocalLibsqlClient): () => number {
  const close = vi.spyOn(client, "close");
  return () => close.mock.calls.length;
}

async function pendingState(operation: Promise<unknown>): Promise<"pending" | "settled"> {
  return Promise.race([
    operation.then(
      () => "settled" as const,
      () => "settled" as const,
    ),
    new Promise<"pending">((resolve) => setTimeout(() => resolve("pending"), 100)),
  ]);
}

async function releaseSelected(evidence: ProjectStorageOpenEvidence): Promise<void> {
  expect(evidence.status).toBe("selected-current");
  if (evidence.status !== "selected-current") {
    throw new Error("Expected current Project Storage selection.");
  }
  await evidence.release();
}

type InspectionSettlement =
  | Readonly<{ status: "resolved" }>
  | Readonly<{ status: "rejected"; error: unknown }>;

async function settleInspection(
  operation: Promise<ProjectStorageOpenEvidence>,
): Promise<InspectionSettlement> {
  try {
    await operation;
    return { status: "resolved" };
  } catch (error) {
    return { status: "rejected", error };
  }
}

function expectInitializationRejection(
  settlement: InspectionSettlement,
  root: string,
  initializationFailure: Error,
): void {
  if (settlement.status !== "rejected") {
    throw new Error("Expected shared application initialization to reject.");
  }
  expect(settlement.error).toMatchObject({
    name: "ProjectStorageBrokenError",
    message: "Project Storage application authority is invalid.",
  });
  expectNotToExpose(settlement.error, root);
  expectNotToExpose(settlement.error, initializationFailure.message);
}

it(
  "shares one deferred application-client initialization across Projects",
  async () => {
    const root = await createHealthyProjectStorageFixture();
    const otherRequest = ProjectStorageOpenRequestSchema.parse({
      projectId: "00000000-0000-4000-8000-000000000099",
    });
    const started = deferred();
    const initialization = deferred();
    let initializationCount = 0;
    let applicationCloseCount: (() => number) | undefined;
    const dependencies = createNodeProjectStorageDependencies({
      applicationStorageRoot: root,
      migrationResourcesRoot: checkedInMigrationRoot,
      applicationVersion: "0.0.0",
      initializeApplicationClient: async (client) => {
        initializationCount += 1;
        applicationCloseCount = observeClose(client);
        started.resolve();
        await initialization.promise;
        await client.execute("PRAGMA foreign_keys = ON");
      },
    });

    const selectedPromise = dependencies.opening.inspect(openRequest.projectId);
    const inspections: Promise<ProjectStorageOpenEvidence>[] = [selectedPromise];
    try {
      await started.promise;
      const absentPromise = dependencies.opening.inspect(otherRequest.projectId);
      inspections.push(absentPromise);
      expect(await pendingState(absentPromise)).toBe("pending");
      expect(initializationCount).toBe(1);
      initialization.resolve();
      const [selected, absent] = await Promise.all([selectedPromise, absentPromise]);
      expect(absent).toEqual({ status: "not-registered" });
      await releaseSelected(selected);
      expect(
        required(applicationCloseCount, "Application client close observation is unavailable.")(),
      ).toBe(0);
    } finally {
      initialization.resolve();
      await Promise.allSettled(inspections);
      await dependencies.registry.stop();
    }
    expect(initializationCount).toBe(1);
    expect(
      required(applicationCloseCount, "Application client close observation is unavailable.")(),
    ).toBe(1);
  },
  projectStorageIntegrationTimeout,
);

it(
  "clears only the failed shared initialization and retries once",
  async () => {
    const root = await createHealthyProjectStorageFixture();
    const otherRequest = ProjectStorageOpenRequestSchema.parse({
      projectId: "00000000-0000-4000-8000-000000000099",
    });
    const initializationFailure = new Error(`${root}: first initialization failed`);
    let initializationCount = 0;
    const applicationCloseCounts: Array<() => number> = [];
    const dependencies = createNodeProjectStorageDependencies({
      applicationStorageRoot: root,
      migrationResourcesRoot: checkedInMigrationRoot,
      applicationVersion: "0.0.0",
      initializeApplicationClient: async (client) => {
        initializationCount += 1;
        applicationCloseCounts.push(observeClose(client));
        if (initializationCount === 1) {
          await Promise.resolve();
          throw initializationFailure;
        }
        await client.execute("PRAGMA foreign_keys = ON");
      },
    });

    try {
      const failed = await Promise.all([
        settleInspection(dependencies.opening.inspect(openRequest.projectId)),
        settleInspection(dependencies.opening.inspect(otherRequest.projectId)),
      ]);
      expect(initializationCount).toBe(1);
      expect(failed.map(({ status }) => status)).toEqual(["rejected", "rejected"]);
      for (const result of failed) {
        expectInitializationRejection(result, root, initializationFailure);
      }
      expect(
        required(applicationCloseCounts[0], "Failed client close observation is unavailable.")(),
      ).toBe(1);

      const retried = await dependencies.opening.inspect(openRequest.projectId);
      expect(initializationCount).toBe(2);
      await releaseSelected(retried);
      expect(
        required(applicationCloseCounts[1], "Retained client close observation is unavailable.")(),
      ).toBe(0);
    } finally {
      await dependencies.registry.stop();
    }
    expect(
      required(applicationCloseCounts[0], "Failed client close observation is unavailable.")(),
    ).toBe(1);
    expect(
      required(applicationCloseCounts[1], "Retained client close observation is unavailable.")(),
    ).toBe(1);
  },
  projectStorageIntegrationTimeout,
);
