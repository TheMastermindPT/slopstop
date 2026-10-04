import path from "node:path";
import { decodeStrict } from "@slopstop/protocol";
import { expect } from "vitest";
import {
  createProjectRegistrationObserver,
  type GitVersionInspectionRequest,
  GitVersionInspectionRequestSchema,
  GitVersionInspectionResultSchema,
} from "../../src/project-registration-observer.js";
import { createGitVersionInspection } from "../../src/registration/git-version-inspection.js";
import {
  createRegistrationRegistry,
  type RegistrationRegistry,
} from "../../src/registration/registration-registry.js";
import {
  createVersionObservationExecution,
  type GitVersionChildPort,
  type VersionObserverJournal,
  type WindowsObserverChildIdentity,
} from "../../src/registration/version-observation-execution.js";
import { createWindowsVersionChild } from "../../src/registration/windows-version-child.js";
import { createWorkerLocalLibsqlClient } from "../../src/storage/local-libsql-worker-client.js";
import { observeSelectedExecutable } from "../../src/storage/repository-identity-observer.js";
import { switchDeferred } from "./project-storage-runtime-fixture.js";

export async function inspectStoredConsent(root: string, request: GitVersionInspectionRequest) {
  const reopened = createRegistrationRegistry({
    applicationStorageRoot: root,
    migrationResourcesRoot: path.resolve(import.meta.dirname, "../../drizzle"),
  });
  try {
    const observer = createProjectRegistrationObserver(
      createGitVersionInspection(reopened, {
        inspect: async () =>
          decodeStrict(GitVersionInspectionResultSchema, {
            status: "prepared",
            selectionId: request.selectionId,
            observationId: "c42caec7-06c4-49bd-9a34-e5b034ab2477",
            version: "2.53.0.windows.1",
          }),
      }),
      { hasUnsettled: async () => false },
    );
    return await observer.inspectGitVersion(request);
  } finally {
    await reopened.stop();
  }
}

export async function readObserverRows(root: string, table: "outcomes" | "terminals" | "children") {
  const statements = {
    outcomes: "SELECT result_json FROM registration_observer_outcomes",
    terminals: "SELECT * FROM registration_observer_terminals",
    children: "SELECT * FROM registration_observer_children",
  };
  const check = createWorkerLocalLibsqlClient(path.join(root, "application.db"), "application");
  try {
    return (await check.execute(statements[table])).rows;
  } finally {
    await check.close();
  }
}

export async function createHeldNativeVersionScenario(
  root: string,
  native = createWindowsVersionChild(root),
) {
  const release = switchDeferred<void>();
  const owned = switchDeferred<void>();
  const scenario = await createRegistryVersionScenario(root, {
    run: (dispatch, signal) =>
      native.run(
        {
          ...dispatch,
          onOwned: async (identity) => {
            await dispatch.onOwned(identity);
            owned.resolve();
            await release.promise;
          },
        },
        signal,
      ),
  });
  return { ...scenario, release, owned };
}

export async function createStoredVersionConsent(root: string) {
  const registry = createRegistrationRegistry({
    applicationStorageRoot: root,
    migrationResourcesRoot: path.resolve(import.meta.dirname, "../../drizzle"),
  });
  const request = decodeStrict(GitVersionInspectionRequestSchema, {
    selectionId: "a728db30-50c9-4aef-a5d6-9a70536314fe",
    consentId: "fefb33aa-d12b-424a-b87a-6f757cd029a3",
  });
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
    ).toEqual({ status: "prepared", selectionId: request.selectionId });
    expect(
      await registry.decideVersion({
        ...request,
        consentId: request.consentId,
        decision: "accepted",
      }),
    ).toEqual({ status: "recorded" });
  } catch (error) {
    await registry.stop();
    throw error;
  }
  return { registry, request };
}

/** A journal that stores the native terminal, signals it, then waits for the test's release. */
export function holdAfterTerminalRecord() {
  const release = switchDeferred<void>();
  const terminalStored = switchDeferred<void>();
  const journalFor = (journal: RegistrationRegistry): VersionObserverJournal => ({
    ...journal,
    recordTerminal: async (id, terminal) => {
      await journal.recordTerminal(id, terminal);
      terminalStored.resolve();
      await release.promise;
    },
  });
  return { release, terminalStored, journalFor };
}

export async function createRegistryVersionScenario(
  root: string,
  child: GitVersionChildPort,
  journalFor: (registry: RegistrationRegistry) => VersionObserverJournal = (registry) => registry,
) {
  const { registry, request } = await createStoredVersionConsent(root);
  const observer = createProjectRegistrationObserver(
    createGitVersionInspection(
      registry,
      createVersionObservationExecution({
        inspectIdentity: observeSelectedExecutable,
        journal: journalFor(registry),
        child,
      }),
    ),
    registry,
  );
  return { registry, request, observer };
}

export async function createRecordedNativeObserver(
  root: string,
  observationId: Parameters<VersionObserverJournal["recordChild"]>[0],
) {
  const location = path.join(process.env["ProgramFiles"] ?? "C:/Program Files", "Git/cmd/git.exe");
  const selection = await observeSelectedExecutable(location);
  expect(selection.status).toBe("observed");
  if (selection.status !== "observed") throw new Error("Executable selection unavailable");
  const identity = selection.identity;
  const journal: string[] = [];
  const owned: WindowsObserverChildIdentity[] = [];
  const observer = createProjectRegistrationObserver(
    createGitVersionInspection(
      {
        resolve: async () => ({
          status: "accepted",
          executablePath: location,
          executableIdentity: identity,
        }),
      },
      createVersionObservationExecution({
        inspectIdentity: observeSelectedExecutable,
        child: createWindowsVersionChild(root),
        journal: {
          readResult: async () => undefined,
          begin: async () => {
            journal.push("intent");
            return { status: "started", observationId };
          },
          complete: async () => {
            journal.push("validated");
          },
          recordChild: async (_id, child) => {
            owned.push(child);
            journal.push("owned");
          },
          recordTerminal: async () => undefined,
          recordNoDispatch: async () => undefined,
          cancel: async () => undefined,
          invalidate: async () => {
            journal.push("invalidated");
          },
        },
      }),
    ),
    { hasUnsettled: async () => false },
  );
  return { observer, journal, owned };
}
