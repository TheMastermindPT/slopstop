import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { decodeStrict, UuidTextSchema } from "@slopstop/protocol";
import { Schema } from "effect";
import { afterEach, expect, it, vi } from "vitest";
import { REGISTRATION_CLEANUP_BUDGET_MS } from "../../src/registration/observer-limits.js";
import { createProjectRegistrationPreparation } from "../../src/registration/project-registration-preparation.js";
import * as identity from "../../src/registration/repository-identity-query-owner.js";
import { RepositoryTrustDecisionSchema } from "../../src/registration/repository-trust.js";
import * as clients from "../../src/storage/local-libsql-worker-client.js";
import {
  consentRegistryOptions,
  createRepositoryTrustScenario,
} from "./registration-consent-fixture.js";
import { gate } from "./registration-git-fixture.js";

const pending = { status: "pending-recovery", code: "OBSERVER_CLEANUP_UNCONFIRMED" } as const;
const roots: string[] = [];
afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

async function fixture(
  closeObservation: () => Promise<{ status: "closed" } | typeof pending>,
  trigger?: "OBSERVATION_LIMIT_EXCEEDED" | "CANCELLED" | "INTERNAL_FAILURE",
) {
  const root = await mkdtemp(path.join(tmpdir(), "opencode/pc-s1-prepare-control-"));
  roots.push(root);
  const scenario = await createRepositoryTrustScenario(root);
  await mkdir(path.join(scenario.directory, ".git"));
  expect(
    await scenario.registry.decideRepositoryTrust(
      decodeStrict(RepositoryTrustDecisionSchema, { ...scenario.trust, decision: "accepted" }),
    ),
  ).toEqual({ status: "recorded" });
  const key = {
    version: "physical-directory/v1" as const,
    platform: "win32" as const,
    volumeIdentity: "1",
    fileIdentity: "2",
    birthIdentity: "3",
  };
  vi.spyOn(identity, "createRepositoryIdentityQueryOwner").mockImplementation((registry) => ({
    inspectPhysicalIdentity: async (input) => {
      const admitted = await registry.admitRepositoryIdentityQueries(input, {
        admit: async () => {},
      });
      if (admitted.status !== "admitted") return admitted;
      if (trigger !== undefined) return { ...pending, trigger };
      return {
        status: "physically-observed" as const,
        phaseId: randomUUID(),
        booleans: {
          insideWorkTree: true as const,
          bareRepository: false as const,
          insideGitDirectory: false as const,
        },
        paths: {
          worktree: scenario.directory,
          gitDirectory: path.join(scenario.directory, ".git"),
          commonDirectory: path.join(scenario.directory, ".git"),
        },
        physical: { worktree: key, gitDirectory: key, commonDirectory: key },
      };
    },
    inspectInsideWorkTree: async () => ({ status: "cancelled" as const }),
    inspectIdentity: async () => ({ status: "cancelled" as const }),
    close: closeObservation,
  }));
  const options = consentRegistryOptions(root);
  const createOwner = () => createProjectRegistrationPreparation(scenario.registry, options, root);
  const owner = createOwner();
  const request = { version: 1, requestId: randomUUID(), admission: scenario.admission };
  return {
    owner,
    request,
    createOwner,
    options,
    rows: async (
      table:
        | "registration_proposals"
        | "registration_requests"
        | "registration_reservations" = "registration_proposals",
    ) => {
      const client = clients.createWorkerLocalLibsqlClient(
        path.join(options.applicationStorageRoot, "application.db"),
        "application",
      );
      try {
        return (await client.execute(`SELECT * FROM ${table}`)).rows;
      } finally {
        await client.close();
      }
    },
    dispose: async () => {
      await owner.close();
      await scenario.observer.close();
      await scenario.registry.stop();
    },
  };
}

it
  .runIf(process.platform === "win32")
  .each(["OBSERVATION_LIMIT_EXCEEDED", "CANCELLED", "INTERNAL_FAILURE"] as const)(
  "preserves the original cleanup trigger %s",
  async (trigger) => {
    const f = await fixture(async () => pending, trigger);
    try {
      expect(await f.owner.prepare(f.request)).toEqual({ ...pending, trigger });
      expect(await f.owner.close()).toEqual(pending);
      expect(await f.rows()).toEqual([]);
    } finally {
      await f.dispose();
    }
  },
);

it.runIf(process.platform === "win32")(
  "reserves one common identity across overlapping independent confirmation owners",
  async () => {
    const entered = gate();
    const release = gate();
    let observations = 0;
    const f = await fixture(async () => {
      observations += 1;
      if (observations === 2) {
        entered.release();
        await release.promise;
      }
      return { status: "closed" };
    });
    const proposal = await f.owner.prepare(f.request);
    if (proposal.status !== "prepared") throw new Error("Preparation unavailable");
    const request = {
      version: 1,
      requestId: randomUUID(),
      preparation: f.request,
      proposalId: proposal.proposalId,
      proposalFingerprint: proposal.proposalFingerprint,
    };
    const first = f.owner.confirm(request);
    const other = f.createOwner();
    try {
      await entered.promise;
      expect(await other.confirm({ ...request, requestId: randomUUID() })).toMatchObject({
        status: "pending-recovery",
        code: "REGISTRATION_INCOMPLETE",
      });
      const reserved = await f.rows("registration_reservations");
      expect(reserved).toHaveLength(1);
      release.release();
      expect(await first).toMatchObject({
        status: "pending-recovery",
        code: "REGISTRATION_INCOMPLETE",
      });
      expect(await f.rows("registration_reservations")).toEqual(reserved);
      expect(await f.rows("registration_requests")).toHaveLength(2);
      const json = reserved[0]?.[5];
      if (typeof json !== "string") throw new Error("Missing reservation record");
      const record = Schema.decodeUnknownSync(
        Schema.Struct({
          projectId: UuidTextSchema,
          repositoryBindingId: UuidTextSchema,
          workspaceId: UuidTextSchema,
          createRequestId: UuidTextSchema,
        }),
      )(JSON.parse(json));
      expect(new Set(Object.values(record)).size).toBe(4);
    } finally {
      release.release();
      await first;
      await other.close();
      await f.dispose();
    }
  },
);

it.runIf(process.platform === "win32")(
  "cancels confirmation validation on owner close without a late validation result",
  async () => {
    const entered = gate();
    const release = gate();
    let observations = 0;
    const f = await fixture(async () => {
      observations += 1;
      if (observations === 2) {
        entered.release();
        await release.promise;
      }
      return { status: "closed" };
    });
    const prepared = await f.owner.prepare(f.request);
    if (prepared.status !== "prepared") throw new Error("Preparation unavailable");
    const work = f.owner.validateConfirmation({
      version: 1,
      requestId: randomUUID(),
      preparation: f.request,
      proposalId: prepared.proposalId,
      proposalFingerprint: prepared.proposalFingerprint,
    });
    try {
      await entered.promise;
      const closing = f.owner.close();
      release.release();
      expect(await work).toEqual({ status: "cancelled" });
      expect(await closing).toEqual({ status: "closed" });
      expect(await f.rows()).toHaveLength(1);
    } finally {
      release.release();
      await work;
      await f.dispose();
    }
  },
);

it.runIf(process.platform === "win32")(
  "preserves observer cleanup refusal in preparation and repeated close after completion",
  async () => {
    const f = await fixture(async () => pending);
    try {
      expect(await f.owner.prepare(f.request)).toEqual(pending);
      expect(await f.owner.close()).toEqual(pending);
      expect(await f.owner.close()).toEqual(pending);
      expect(await f.rows()).toEqual([]);
    } finally {
      await f.dispose();
    }
  },
);

it.runIf(process.platform === "win32")(
  "bounds close at the cleanup deadline and retains its uncertain result",
  async () => {
    const entered = gate();
    const release = gate();
    const f = await fixture(async () => {
      entered.release();
      await release.promise;
      return { status: "closed" };
    });
    const work = f.owner.prepare(f.request);
    try {
      await entered.promise;
      vi.useFakeTimers();
      let result: unknown;
      const closing = f.owner.close().then((value) => {
        result = value;
      });
      await vi.advanceTimersByTimeAsync(REGISTRATION_CLEANUP_BUDGET_MS - 1);
      expect(result).toBeUndefined();
      await vi.advanceTimersByTimeAsync(1);
      expect(result).toEqual(pending);
      await closing;
      expect(await f.owner.close()).toEqual(pending);
      vi.useRealTimers();
      release.release();
      expect(await work).toEqual({ status: "cancelled" });
      expect(await f.owner.close()).toEqual(pending);
      expect(await f.rows()).toEqual([]);
    } finally {
      vi.useRealTimers();
      release.release();
      await work;
      await f.dispose();
    }
  },
);

function holdProposalCommit(stage: "insert" | "commit") {
  const entered = gate();
  const release = gate();
  const createClient = clients.createWorkerLocalLibsqlClient;
  vi.spyOn(clients, "createWorkerLocalLibsqlClient").mockImplementation((...args) => {
    const client = createClient(...args);
    return {
      execute: (statement, args) => client.execute(statement, args),
      close: () => client.close(),
      transaction: async (mode) => {
        const transaction = await client.transaction(mode);
        let inserted = false;
        return {
          get closed() {
            return transaction.closed;
          },
          execute: async (statement, args) => {
            const result = await transaction.execute(statement, args);
            const sql = typeof statement === "string" ? statement : statement.sql;
            if (sql.startsWith("INSERT INTO registration_proposals")) {
              inserted = true;
              if (stage === "insert") {
                entered.release();
                await release.promise;
              }
            }
            return result;
          },
          commit: async () => {
            await transaction.commit();
            if (inserted && stage === "commit") {
              entered.release();
              await release.promise;
            }
          },
          rollback: () => transaction.rollback(),
          close: () => transaction.close(),
        };
      },
    };
  });
  return { entered, release };
}

it.runIf(process.platform === "win32").each(["insert", "commit"] as const)(
  "suppresses late preparation success after close at %s while preserving committed replay",
  async (stage) => {
    const f = await fixture(async () => ({ status: "closed" }));
    const hold = holdProposalCommit(stage);
    const work = f.owner.prepare(f.request);
    try {
      await Promise.race([
        hold.entered.promise,
        work.then((result) => {
          throw new Error(`Preparation settled before commit barrier: ${JSON.stringify(result)}`);
        }),
      ]);
      const closing = f.owner.close();
      hold.release.release();
      expect(await work).toEqual({ status: "cancelled" });
      expect(await closing).toEqual({ status: "closed" });
      const rows = await f.rows();
      expect(rows).toHaveLength(1);
      const observations = vi.mocked(identity.createRepositoryIdentityQueryOwner).mock.calls.length;
      const reopened = f.createOwner();
      try {
        const replay = await reopened.prepare(f.request);
        expect(replay).toMatchObject({
          status: "prepared",
          proposalId: rows[0]?.[1],
          requiresFreshValidation: true,
        });
        expect(vi.mocked(identity.createRepositoryIdentityQueryOwner).mock.calls.length).toBe(
          observations,
        );
        expect(await f.rows()).toEqual(rows);
      } finally {
        await reopened.close();
      }
    } finally {
      hold.release.release();
      await work;
      await f.dispose();
    }
  },
);

it.runIf(process.platform === "win32")(
  "settles concurrent observed requests as the one original durable proposal",
  async () => {
    const firstObserved = gate();
    const releaseFirst = gate();
    let observations = 0;
    const f = await fixture(async () => {
      observations += 1;
      if (observations === 1) {
        firstObserved.release();
        await releaseFirst.promise;
      }
      return { status: "closed" };
    });
    const first = f.owner.prepare(f.request);
    const other = f.createOwner();
    try {
      await firstObserved.promise;
      const winner = await other.prepare(f.request);
      expect(winner.status).toBe("prepared");
      const rows = await f.rows();
      expect(rows).toHaveLength(1);
      releaseFirst.release();
      expect(await first).toEqual(winner);
      expect(observations).toBe(2);
      expect(await f.rows()).toEqual(rows);
    } finally {
      releaseFirst.release();
      await first;
      await other.close();
      await f.dispose();
    }
  },
);
