import { mkdir, readFile, rename, stat } from "node:fs/promises";
import path from "node:path";
import { expect, it, vi } from "vitest";
import { GitVersionInspectionRequestSchema } from "../../src/project-registration-observer.js";
import { createRegistrationRegistry } from "../../src/registration/registration-registry.js";
import {
  RepositoryIdentityAdmissionRequestSchema,
  RepositoryTrustRequestSchema,
} from "../../src/registration/repository-trust.js";
import * as native from "../../src/registration/windows-observer-api.js";
import { createWorkerLocalLibsqlClient } from "../../src/storage/local-libsql-worker-client.js";
import { switchDeferred } from "./project-storage-runtime-fixture.js";
import {
  consentRegistryOptions,
  createControlledIdentityConsent,
  createRepositoryTrustScenario,
} from "./registration-consent-fixture.js";
import {
  pinDecisionTimestamp,
  preservedDecisionTimestamp,
  readDecisionRows,
} from "./registration-decision-oracle.js";

const recorded = { status: "recorded" };
const admittedResult = { status: "admitted" };
const trustRequired = { status: "unavailable", code: "REPOSITORY_TRUST_REQUIRED" };

function injectDirectoryOpenFault(directory: string, fault: number | "unexpected") {
  const api = native.createWindowsObserverApi();
  let hits = 0;
  const spy = vi.spyOn(native, "createWindowsObserverApi").mockImplementation(() => {
    let directoryFailed = false;
    return {
      ...api,
      createFile: (...args) => {
        directoryFailed = args[0] === directory;
        if (!directoryFailed) return api.createFile(...args);
        hits += 1;
        if (fault === "unexpected") throw new Error("controlled-unexpected-directory-failure");
        return null;
      },
      lastError: () => (directoryFailed && typeof fault === "number" ? fault : api.lastError()),
    };
  });
  return { hits: () => hits, restore: () => spy.mockRestore() };
}

function captureAdmissions() {
  const admitted: string[] = [];
  const port = {
    admit: async (input: { repositoryDirectory: string }) => {
      admitted.push(input.repositoryDirectory);
    },
  };
  return { admitted, port };
}

async function beginUnsettledObserver(
  scenario: Awaited<ReturnType<typeof createRepositoryTrustScenario>>,
) {
  const next = GitVersionInspectionRequestSchema.parse({
    ...scenario.stageOne,
    consentId: "707c9723-44df-4a96-9e6e-ce7afce6ae68",
  });
  if (next.consentId === null) throw new Error("Test consent missing");
  expect(
    await scenario.registry.decideVersion({
      ...next,
      consentId: next.consentId,
      decision: "accepted",
    }),
  ).toEqual(recorded);
  const authority = await scenario.registry.resolve(next);
  if (authority.status !== "accepted") throw new Error("Version authority unavailable");
  const pending = await scenario.registry.begin({
    ...next,
    consentId: next.consentId,
    executablePath: authority.executablePath,
    executableIdentity: authority.executableIdentity,
  });
  if (pending.status !== "started") throw new Error("Expected unsettled observer");
  return pending.observationId;
}

export function defineRepositoryTrustCases(createRoot: (prefix: string) => Promise<string>) {
  it("drains admitted identity execution on stop without admitting later work", async () => {
    const scenario = await createRepositoryTrustScenario(
      await createRoot("pc-s1-identity-execution-stop-"),
    );
    const entered = switchDeferred<void>();
    const release = switchDeferred<void>();
    let entries = 0;
    const port = {
      admit: async () => {
        entries += 1;
        entered.resolve();
        await release.promise;
      },
    };
    try {
      expect(
        await scenario.registry.decideRepositoryTrust({ ...scenario.trust, decision: "accepted" }),
      ).toEqual(recorded);
      const pending = scenario.registry.admitRepositoryIdentityQueries(scenario.admission, port);
      try {
        await entered.promise;
        let stopped = false;
        const stopping = scenario.registry.stop().then(() => {
          stopped = true;
        });
        expect(
          await scenario.registry.admitRepositoryIdentityQueries(scenario.admission, port),
        ).toEqual({ status: "broken", code: "INTERNAL_FAILURE" });
        expect(entries).toBe(1);
        expect(stopped).toBe(false);
        release.resolve();
        expect(await pending).toEqual(admittedResult);
        await stopping;
        expect(stopped).toBe(true);
      } finally {
        release.resolve();
        await pending;
      }
    } finally {
      await scenario.observer.close();
      await scenario.registry.stop();
    }
  });

  it("maps unexpected admitted identity execution failure without reporting admission success", async () => {
    const scenario = await createRepositoryTrustScenario(
      await createRoot("pc-s1-identity-execution-error-"),
    );
    try {
      expect(
        await scenario.registry.decideRepositoryTrust({ ...scenario.trust, decision: "accepted" }),
      ).toEqual(recorded);
      expect(
        await scenario.registry.admitRepositoryIdentityQueries(scenario.admission, {
          admit: async () => {
            throw new Error("controlled-execution-failure");
          },
        }),
      ).toEqual({ status: "broken", code: "INTERNAL_FAILURE" });
    } finally {
      await scenario.observer.close();
      await scenario.registry.stop();
    }
  });

  it("lets admitted identity execution access the durable journal without a held write transaction", async () => {
    const scenario = await createRepositoryTrustScenario(
      await createRoot("pc-s1-identity-journal-admission-"),
    );
    const entries: boolean[] = [];
    const port = {
      admit: async () => {
        entries.push(await scenario.registry.hasUnsettled());
      },
    };
    try {
      expect(
        await scenario.registry.admitRepositoryIdentityQueries(scenario.admission, port),
      ).toEqual(trustRequired);
      expect(entries).toEqual([]);
      expect(
        await scenario.registry.decideRepositoryTrust({ ...scenario.trust, decision: "accepted" }),
      ).toEqual(recorded);
      expect(
        await scenario.registry.admitRepositoryIdentityQueries(scenario.admission, port),
      ).toEqual(admittedResult);
      expect(entries).toEqual([false]);
    } finally {
      await scenario.observer.close();
      await scenario.registry.stop();
    }
  });

  it("returns native cancellation while another owner holds the registry write transaction", async () => {
    const root = await createRoot("pc-s1-trust-cancel-busy-");
    const options = consentRegistryOptions(root);
    const entered = switchDeferred<void>();
    const release = switchDeferred<void>();
    const registry = createRegistrationRegistry(options, {
      select: async () => {
        entered.resolve();
        await release.promise;
        return { status: "cancelled" };
      },
    });
    const pending = registry.selectRepository();
    try {
      await entered.promise;
      const locker = createWorkerLocalLibsqlClient(
        path.join(options.applicationStorageRoot, "application.db"),
        "application",
      );
      try {
        const held = await locker.transaction("write");
        try {
          release.resolve();
          expect(await pending).toEqual({ status: "cancelled" });
          expect(
            (await held.execute("SELECT * FROM registration_repository_selections")).rows,
          ).toEqual([]);
        } finally {
          await held.rollback();
          await held.close();
        }
      } finally {
        await locker.close();
      }
    } finally {
      release.resolve();
      await pending;
      await registry.stop();
    }
  });

  it("does not recreate a registry moved while native selection is pending", async () => {
    const root = await createRoot("pc-s1-trust-registry-disappeared-");
    const options = consentRegistryOptions(root);
    const entered = switchDeferred<void>();
    const release = switchDeferred<void>();
    const registry = createRegistrationRegistry(options, {
      select: async () => {
        entered.resolve();
        await release.promise;
        return { status: "selected", directory: root };
      },
    });
    const pending = registry.selectRepository();
    try {
      await entered.promise;
      const databasePath = path.join(options.applicationStorageRoot, "application.db");
      const before = await readFile(databasePath);
      const moved = path.join(root, "installation-moved");
      await rename(options.applicationStorageRoot, moved);
      release.resolve();
      expect(await pending).toEqual({
        status: "pending-recovery",
        code: "REGISTRY_MISSING_WITH_WITNESS",
      });
      await expect(stat(options.applicationStorageRoot)).rejects.toMatchObject({ code: "ENOENT" });
      await expect(stat(databasePath)).rejects.toMatchObject({ code: "ENOENT" });
      expect(await readFile(path.join(moved, "application.db"))).toEqual(before);
    } finally {
      release.resolve();
      await pending;
      await registry.stop();
    }
  });

  it.each([
    [2, { status: "rejected", code: "REPOSITORY_NOT_FOUND" }],
    [3, { status: "rejected", code: "REPOSITORY_NOT_FOUND" }],
    [6, { status: "broken", code: "INTERNAL_FAILURE" }],
    ["unexpected", { status: "broken", code: "INTERNAL_FAILURE" }],
  ] as const)(
    "preserves Windows directory failure %s without admission",
    async (error, expected) => {
      const scenario = await createRepositoryTrustScenario(
        await createRoot("pc-s1-trust-directory-error-"),
      );
      const { admitted, port } = captureAdmissions();
      try {
        expect(
          await scenario.registry.decideRepositoryTrust({
            ...scenario.trust,
            decision: "accepted",
          }),
        ).toEqual(recorded);
        const fault = injectDirectoryOpenFault(scenario.directory, error);
        try {
          expect(await scenario.registry.selectRepository()).toEqual(expected);
          expect(
            await scenario.registry.admitRepositoryIdentityQueries(scenario.admission, port),
          ).toEqual(expected);
          expect(admitted).toEqual([]);
          expect(fault.hits()).toBe(2);
        } finally {
          fault.restore();
        }
      } finally {
        await scenario.observer.close();
        await scenario.registry.stop();
      }
    },
  );

  it.each(["selection", "revalidation"] as const)(
    "reports Windows directory access denied during %s without admission",
    async (stage) => {
      const root = await createRoot("pc-s1-trust-access-denied-");
      const scenario = await createRepositoryTrustScenario(root);
      const { admitted, port } = captureAdmissions();
      try {
        expect(
          await scenario.registry.decideRepositoryTrust({
            ...scenario.trust,
            decision: "accepted",
          }),
        ).toEqual(recorded);
        const fault = injectDirectoryOpenFault(scenario.directory, 5);
        try {
          const result =
            stage === "selection"
              ? await scenario.registry.selectRepository()
              : await scenario.registry.admitRepositoryIdentityQueries(scenario.admission, port);
          expect(fault.hits()).toBe(1);
          expect(admitted).toEqual([]);
          expect(result).toEqual({ status: "unavailable", code: "REPOSITORY_INACCESSIBLE" });
        } finally {
          fault.restore();
        }
        expect(
          await scenario.registry.admitRepositoryIdentityQueries(scenario.admission, port),
        ).toEqual(admittedResult);
        expect(admitted).toEqual([scenario.directory]);
      } finally {
        await scenario.observer.close();
        await scenario.registry.stop();
      }
    },
  );

  it("drains pending native selection on stop and rejects later registry work", async () => {
    const root = await createRoot("pc-s1-trust-selection-stop-");
    const entered = switchDeferred<void>();
    const release = switchDeferred<void>();
    const registry = createRegistrationRegistry(consentRegistryOptions(root), {
      select: async () => {
        entered.resolve();
        await release.promise;
        return { status: "selected", directory: root };
      },
    });
    const pending = registry.selectRepository();
    let stopped = false;
    try {
      await entered.promise;
      const stopping = registry.stop().then(() => {
        stopped = true;
      });
      expect(await registry.selectRepository()).toEqual({
        status: "broken",
        code: "INTERNAL_FAILURE",
      });
      expect(stopped).toBe(false);
      release.resolve();
      expect((await pending).status).toBe("prepared");
      await stopping;
      expect(stopped).toBe(true);
    } finally {
      release.resolve();
      await pending;
      await registry.stop();
    }
  });

  it.each(["registry", "directory"] as const)(
    "rechecks current %s after pending native selection before saving",
    async (changed) => {
      const root = await createRoot("pc-s1-trust-selection-recheck-");
      const directory = path.join(root, "repository");
      await mkdir(directory);
      const entered = switchDeferred<void>();
      const release = switchDeferred<void>();
      const registry = createRegistrationRegistry(consentRegistryOptions(root), {
        select: async () => {
          entered.resolve();
          await release.promise;
          return { status: "selected", directory };
        },
      });
      const pending = registry.selectRepository();
      try {
        await entered.promise;
        const database = createWorkerLocalLibsqlClient(
          path.join(root, "installation/application.db"),
          "application",
        );
        try {
          if (changed === "registry") {
            await database.execute("UPDATE schema_metadata SET last_migration_id = 'unknown-head'");
          } else {
            await rename(directory, `${directory}-moved`);
          }
          release.resolve();
          expect(await pending).toEqual(
            changed === "registry"
              ? { status: "broken", code: "REGISTRY_SCHEMA_UNKNOWN" }
              : { status: "rejected", code: "REPOSITORY_NOT_FOUND" },
          );
          expect(
            (await database.execute("SELECT * FROM registration_repository_selections")).rows,
          ).toEqual([]);
        } finally {
          await database.close();
        }
      } finally {
        release.resolve();
        await pending;
        await registry.stop();
      }
    },
  );

  it("maps unexpected native selection failure before persistence to internal failure", async () => {
    const root = await createRoot("pc-s1-trust-selection-error-");
    const registry = createRegistrationRegistry(consentRegistryOptions(root), {
      select: async () => {
        throw new Error("controlled-native-selection-failure");
      },
    });
    try {
      expect(await registry.selectRepository()).toEqual({
        status: "broken",
        code: "INTERNAL_FAILURE",
      });
    } finally {
      await registry.stop();
    }
  });

  it("allows another registry decision while native repository selection remains pending", async () => {
    const root = await createRoot("pc-s1-trust-pending-selection-");
    const scenario = await createRepositoryTrustScenario(root);
    const entered = switchDeferred<void>();
    const release = switchDeferred<void>();
    const chooser = createRegistrationRegistry(consentRegistryOptions(root), {
      select: async () => {
        entered.resolve();
        await release.promise;
        return { status: "cancelled" };
      },
    });
    const pending = chooser.selectRepository();
    try {
      await entered.promise;
      expect(
        await scenario.registry.decideRepositoryTrust({ ...scenario.trust, decision: "accepted" }),
      ).toEqual(recorded);
    } finally {
      release.resolve();
      await pending;
      await chooser.stop();
      await scenario.observer.close();
      await scenario.registry.stop();
    }
  });

  it("classifies malformed stored repository identity as registry corruption without admission", async () => {
    const root = await createRoot("pc-s1-trust-corrupt-identity-");
    const scenario = await createRepositoryTrustScenario(root);
    const { admitted, port } = captureAdmissions();
    const database = createWorkerLocalLibsqlClient(
      path.join(root, "installation/application.db"),
      "application",
    );
    try {
      expect(
        await scenario.registry.decideRepositoryTrust({ ...scenario.trust, decision: "accepted" }),
      ).toEqual(recorded);
      await database.execute({
        sql: "UPDATE registration_repository_selections SET identity_json = ? WHERE selection_id = ?",
        args: ["{}", scenario.trust.repositorySelectionId],
      });
      const result = await scenario.registry.admitRepositoryIdentityQueries(
        scenario.admission,
        port,
      );
      expect(admitted).toEqual([]);
      expect(result).toEqual({ status: "broken", code: "REGISTRY_CORRUPT" });
    } finally {
      await database.close();
      await scenario.observer.close();
      await scenario.registry.stop();
    }
  });

  it.each([
    ["selectionId", "GIT_CONFIRMATION_REQUIRED"],
    ["observationId", "GIT_CONFIRMATION_REQUIRED"],
    ["consentId", "GIT_CONFIRMATION_REQUIRED"],
    ["repositorySelectionId", "REPOSITORY_TRUST_REQUIRED"],
    ["trustId", "REPOSITORY_TRUST_REQUIRED"],
  ])("does not admit repository-trust with inapplicable %s", async (field, code) => {
    const scenario = await createRepositoryTrustScenario(
      await createRoot("pc-s1-trust-inapplicable-"),
    );
    const { admitted, port } = captureAdmissions();
    try {
      const decision = { ...scenario.trust, decision: "accepted" as const };
      expect(await scenario.registry.decideRepositoryTrust(decision)).toEqual(recorded);
      const request = RepositoryIdentityAdmissionRequestSchema.parse({
        ...scenario.admission,
        [field]: "d448cb38-1f78-44ab-b2a3-01cbecb4bc70",
      });
      expect(await scenario.registry.admitRepositoryIdentityQueries(request, port)).toEqual({
        status: "unavailable",
        code,
      });
      expect(admitted).toEqual([]);
      expect(
        await scenario.registry.admitRepositoryIdentityQueries(scenario.admission, port),
      ).toEqual(admittedResult);
      expect(admitted).toEqual([scenario.directory]);
    } finally {
      await scenario.observer.close();
      await scenario.registry.stop();
    }
  });

  it("keeps native repository-trust cancellation and absent native capability explicit", async () => {
    const root = await createRoot("pc-s1-native-selection-cancel-");
    const options = consentRegistryOptions(root);
    const registry = createRegistrationRegistry(options, {
      select: async () => ({ status: "cancelled" }),
    });
    try {
      expect(await registry.selectRepository()).toEqual({ status: "cancelled" });
    } finally {
      await registry.stop();
    }
    const reopened = createRegistrationRegistry(options);
    try {
      expect(await reopened.selectRepository()).toEqual({
        status: "unavailable",
        code: "IDENTITY_CAPABILITY_UNAVAILABLE",
      });
    } finally {
      await reopened.stop();
    }
  });

  it("blocks repository-trust admission behind unresolved observer ownership", async () => {
    const scenario = await createRepositoryTrustScenario(
      await createRoot("pc-s1-trust-unsettled-"),
    );
    const { admitted, port } = captureAdmissions();
    try {
      const decision = { ...scenario.trust, decision: "accepted" as const };
      expect(await scenario.registry.decideRepositoryTrust(decision)).toEqual(recorded);
      const observationId = await beginUnsettledObserver(scenario);
      expect(
        await scenario.registry.admitRepositoryIdentityQueries(scenario.admission, port),
      ).toEqual({ status: "pending-recovery", code: "OBSERVER_CLEANUP_UNCONFIRMED" });
      expect(admitted).toEqual([]);
      await scenario.registry.recordNoDispatch(observationId);
      expect(
        await scenario.registry.admitRepositoryIdentityQueries(scenario.admission, port),
      ).toEqual(admittedResult);
      expect(admitted).toEqual([scenario.directory]);
    } finally {
      await scenario.observer.close();
      await scenario.registry.stop();
    }
  });

  it("records repository-trust decisions idempotently and cannot overwrite refusal", async () => {
    const root = await createRoot("pc-s1-trust-refused-");
    const scenario = await createRepositoryTrustScenario(root);
    const { admitted, port } = captureAdmissions();
    const applicationRoot = consentRegistryOptions(root).applicationStorageRoot;
    const table = "registration_repository_trust";
    const decline = { ...scenario.trust, decision: "declined" as const };
    let before: ReturnType<typeof readDecisionRows>;
    try {
      expect(await scenario.registry.decideRepositoryTrust(decline)).toEqual(recorded);
      before = pinDecisionTimestamp(applicationRoot, table);
      expect(before).toEqual([
        {
          trust_id: scenario.trust.trustId,
          selection_id: scenario.trust.repositorySelectionId,
          decision: "declined",
          decided_at: preservedDecisionTimestamp,
        },
      ]);
      expect(await scenario.registry.decideRepositoryTrust(decline)).toEqual(recorded);
      expect(readDecisionRows(applicationRoot, table)).toEqual(before);
      expect(
        await scenario.registry.decideRepositoryTrust({ ...scenario.trust, decision: "accepted" }),
      ).toEqual({ status: "rejected", code: "REGISTRATION_IDEMPOTENCY_CONFLICT" });
      expect(readDecisionRows(applicationRoot, table)).toEqual(before);
    } finally {
      await scenario.observer.close();
      await scenario.registry.stop();
    }
    const reopened = createRegistrationRegistry(consentRegistryOptions(root));
    try {
      expect(readDecisionRows(applicationRoot, table)).toEqual(before);
      expect(await reopened.decideRepositoryTrust(decline)).toEqual(recorded);
      expect(readDecisionRows(applicationRoot, table)).toEqual(before);
      expect(
        await reopened.decideRepositoryTrust({ ...scenario.trust, decision: "accepted" }),
      ).toEqual({
        status: "rejected",
        code: "REGISTRATION_IDEMPOTENCY_CONFLICT",
      });
      expect(readDecisionRows(applicationRoot, table)).toEqual(before);
      expect(await reopened.admitRepositoryIdentityQueries(scenario.admission, port)).toEqual({
        status: "cancelled",
      });
      expect(admitted).toEqual([]);
      expect(readDecisionRows(applicationRoot, table)).toEqual(before);
    } finally {
      await reopened.stop();
    }
  });

  it("rejects repository-trust for B and physically replaced A without admission", async () => {
    const root = await createRoot("pc-s1-trust-scope-");
    const scenario = await createControlledIdentityConsent(root);
    const directoryA = path.join(root, "A");
    const directoryB = path.join(root, "B");
    await mkdir(directoryA);
    await mkdir(directoryB);
    let directory = directoryA;
    const registry = createRegistrationRegistry(consentRegistryOptions(root), {
      select: async () => ({ status: "selected", directory }),
    });
    const { admitted, port } = captureAdmissions();
    try {
      const decision = { ...scenario.request, decision: "accepted" as const };
      expect(await registry.decideIdentityQueries(decision)).toEqual(recorded);
      const selectedA = await registry.selectRepository();
      if (selectedA.status !== "prepared") throw new Error("Selection A unavailable");
      const trustA = RepositoryTrustRequestSchema.parse({
        repositorySelectionId: selectedA.repositorySelectionId,
        trustId: "5b4ba3c7-10e5-41cb-b25d-07a8970901c8",
      });
      expect(await registry.decideRepositoryTrust({ ...trustA, decision: "accepted" })).toEqual(
        recorded,
      );
      directory = directoryB;
      const selectedB = await registry.selectRepository();
      if (selectedB.status !== "prepared") throw new Error("Selection B unavailable");
      expect(selectedB.repositorySelectionId).not.toBe(selectedA.repositorySelectionId);
      const requestA = { ...scenario.request, ...trustA };
      expect(
        await registry.admitRepositoryIdentityQueries(
          { ...requestA, repositorySelectionId: selectedB.repositorySelectionId },
          port,
        ),
      ).toEqual(trustRequired);
      expect(admitted).toEqual([]);
      expect(await registry.admitRepositoryIdentityQueries(requestA, port)).toEqual(admittedResult);
      await rename(directoryA, `${directoryA}-original`);
      await mkdir(directoryA);
      expect(await registry.admitRepositoryIdentityQueries(requestA, port)).toEqual(trustRequired);
      expect(admitted).toEqual([directoryA]);
    } finally {
      await registry.stop();
      await scenario.observer.close();
      await scenario.registry.stop();
    }
  });

  it("admits exact repository-trust only after persisted native selection and both decisions", async () => {
    const root = await createRoot("pc-s1-repository-trust-");
    const scenario = await createControlledIdentityConsent(root);
    const directory = path.join(root, "repository-A");
    await mkdir(directory);
    try {
      const decision = { ...scenario.request, decision: "accepted" as const };
      expect(await scenario.registry.decideIdentityQueries(decision)).toEqual(recorded);
    } finally {
      await scenario.observer.close();
      await scenario.registry.stop();
    }
    const options = consentRegistryOptions(root);
    const selected = createRegistrationRegistry(options, {
      select: async () => ({ status: "selected", directory }),
    });
    let selection: Awaited<ReturnType<typeof selected.selectRepository>>;
    try {
      selection = await selected.selectRepository();
    } finally {
      await selected.stop();
    }
    expect(selection.status).toBe("prepared");
    if (selection.status !== "prepared") throw new Error("Native selection unavailable");
    const trust = RepositoryTrustRequestSchema.parse({
      repositorySelectionId: selection.repositorySelectionId,
      trustId: "7a337006-00cd-4dd1-a202-b5d913ea6d14",
    });
    const restarted = createRegistrationRegistry(options);
    const { admitted, port } = captureAdmissions();
    const request = { ...scenario.request, ...trust };
    try {
      expect(await restarted.admitRepositoryIdentityQueries(request, port)).toEqual(trustRequired);
      expect(admitted).toEqual([]);
      expect(await restarted.decideRepositoryTrust({ ...trust, decision: "accepted" })).toEqual(
        recorded,
      );
    } finally {
      await restarted.stop();
    }
    const final = createRegistrationRegistry(options);
    try {
      expect(await final.admitRepositoryIdentityQueries(request, port)).toEqual(admittedResult);
      expect(admitted).toEqual([directory]);
    } finally {
      await final.stop();
    }
  });
}
