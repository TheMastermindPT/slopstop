import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { decodeStrict } from "@slopstop/protocol";
import { afterEach, expect, it, vi } from "vitest";
import { GitVersionInspectionRequestSchema } from "../../src/project-registration-observer.js";
import { createRegistrationRegistry } from "../../src/registration/registration-registry.js";
import * as absence from "../../src/registration/windows-observer-absence.js";
import { createWorkerLocalLibsqlClient } from "../../src/storage/local-libsql-worker-client.js";
import * as filesystem from "../../src/storage/project-storage-filesystem-authority.js";
import type { UpgradeEventLogger } from "../../src/upgrade-diagnostics-logger.js";
import { checkedInMigrationRoot, switchDeferred } from "./project-storage-runtime-fixture.js";
import {
  injectAbsenceFault,
  recordAbsenceSubject,
  startAbsenceSubject,
} from "./registration-absence-fixture.js";
import { createRepositoryTrustScenario } from "./registration-consent-fixture.js";
import { registrationSession, type Session } from "./registration-flow-fixture.js";
import { startObserverOwner } from "./registration-owner-recovery-fixture.js";
import { createStoredVersionConsent } from "./registration-version-fixture.js";
import { temporaryRoot } from "./temporary-root.js";

const pendingRecovery = { status: "pending-recovery", code: "OBSERVER_CLEANUP_UNCONFIRMED" };

const roots: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

/** A root whose `installation` folder is the application storage root of a later session. */
async function installationRoot(prefix: string) {
  const root = await temporaryRoot(prefix);
  roots.push(root);
  const installation = path.join(root, "installation");
  await mkdir(installation, { recursive: true });
  return { root, installation };
}

async function unsettledAt(installation: string): Promise<boolean> {
  const registry = createRegistrationRegistry({
    applicationStorageRoot: installation,
    migrationResourcesRoot: checkedInMigrationRoot,
  });
  try {
    return await registry.hasUnsettled();
  } finally {
    await registry.stop();
  }
}

async function storedOutcome(installation: string, observationId: string): Promise<unknown[]> {
  const client = createWorkerLocalLibsqlClient(
    path.join(installation, "application.db"),
    "application",
  );
  try {
    const result = await client.execute({
      sql: "SELECT result_json FROM registration_observer_outcomes WHERE observation_id = ?",
      args: [observationId],
    });
    return result.rows.map(([json]) => (typeof json === "string" ? JSON.parse(json) : json));
  } finally {
    await client.close();
  }
}

/** The first registration request that reaches observer admission: an accepted Git version. */
async function admitGitVersion(session: Session) {
  const git = await session.register({ step: "prepare-git" });
  if (git.status !== "git-prepared") throw new Error(`Git preparation: ${JSON.stringify(git)}`);
  return session.register({
    step: "decide-git-version",
    selectionId: git.selectionId,
    consentId: randomUUID(),
    decision: "accepted",
  });
}

/** The warn objects the harness logged. */
function recordingLogger() {
  const warnings: unknown[] = [];
  return {
    logger: { info: () => undefined, warn: (line: unknown) => warnings.push(line) },
    warnings,
  };
}

/** Starts the production runtime over the root, answers its first admission, then stops it. */
async function admissionAfterRestart(root: string, logger?: UpgradeEventLogger) {
  const session = await registrationSession(logger === undefined ? { root } : { root, logger });
  try {
    return await admitGitVersion(session);
  } finally {
    await session.dispose();
  }
}

it.runIf(process.platform === "win32" && process.arch === "x64")(
  "admits registration after a harness killed mid-query restarts",
  async () => {
    const { root, installation } = await installationRoot("p1-restart-killed-");
    const stored = await createStoredVersionConsent(installation);
    await stored.registry.stop();
    const peer = await startObserverOwner(installation, "child-stored", stored.request);
    await peer.kill();
    expect(await unsettledAt(installation)).toBe(true);

    const admission = await admissionAfterRestart(root);

    expect(admission).not.toEqual(pendingRecovery);
    expect(await unsettledAt(installation)).toBe(false);
    expect(await storedOutcome(installation, peer.reached.observationId)).toEqual([
      { status: "broken", code: "INTERNAL_FAILURE", reconciliation: "exact-owner-absence" },
    ]);
  },
);

it.runIf(process.platform === "win32" && process.arch === "x64")(
  "starts and keeps the gate closed when reconciliation cannot settle",
  async () => {
    const { root, installation } = await installationRoot("p1-restart-live-");
    const { registry, request } = await createStoredVersionConsent(installation);
    const subject = await startAbsenceSubject();
    try {
      try {
        await recordAbsenceSubject(registry, request, subject.identity);
      } finally {
        await registry.stop();
      }
      expect(await unsettledAt(installation)).toBe(true);

      const recording = recordingLogger();
      const admission = await admissionAfterRestart(root, recording.logger);

      expect(admission).toEqual(pendingRecovery);
      expect(recording.warnings).toEqual([]);
      expect(subject.alive()).toBe(true);
      expect(await unsettledAt(installation)).toBe(true);
    } finally {
      await subject.stop();
    }
  },
);

it.runIf(process.platform === "win32" && process.arch === "x64")(
  "keeps the gate answer when the start's reconciliation fails",
  async () => {
    const { root, installation } = await installationRoot("p1-restart-broken-");
    const { registry, request } = await createStoredVersionConsent(installation);
    const subject = await startAbsenceSubject();
    try {
      // A historical creation time: without the fault, reconciliation proves it absent.
      const historical = String(BigInt(subject.identity.creationTime100ns) - 1n);
      try {
        await recordAbsenceSubject(registry, request, {
          ...subject.identity,
          creationTime100ns: historical,
        });
      } finally {
        await registry.stop();
      }
      const fault = injectAbsenceFault("inaccessible-process");
      const recording = recordingLogger();
      let admission: unknown;
      try {
        admission = await admissionAfterRestart(root, recording.logger);
      } finally {
        fault.restore();
      }

      expect(fault.hits()).toBeGreaterThan(0);
      expect(admission).toEqual(pendingRecovery);
      expect(recording.warnings).toEqual([{ code: "REGISTRATION_RECONCILIATION_FAILED" }]);
      expect(await unsettledAt(installation)).toBe(true);
    } finally {
      await subject.stop();
    }
  },
);

/** The production absence port, held at its first probe until the test releases it. */
function heldAbsencePort() {
  const entered = switchDeferred<void>();
  const released = switchDeferred<void>();
  const real = absence.createWindowsObserverAbsencePort();
  const port: ReturnType<typeof absence.createWindowsObserverAbsencePort> = {
    inspect: async (child) => {
      entered.resolve();
      await released.promise;
      return real.inspect(child);
    },
  };
  return { port, entered: entered.promise, release: () => released.resolve() };
}

/** The harness start's absence port is held, through its in-process module. */
function holdAbsenceProbe() {
  const held = heldAbsencePort();
  vi.spyOn(absence, "createWindowsObserverAbsencePort").mockImplementation(() => held.port);
  return held;
}

it.runIf(process.platform === "win32" && process.arch === "x64")(
  "stops cleanly while the start's reconciliation is still running",
  async () => {
    const { root, installation } = await installationRoot("p1-restart-stop-");
    const { registry, request } = await createStoredVersionConsent(installation);
    const subject = await startAbsenceSubject();
    try {
      try {
        await recordAbsenceSubject(registry, request, subject.identity);
      } finally {
        await registry.stop();
      }
      const probe = holdAbsenceProbe();
      const session = await registrationSession({ root });
      await probe.entered;

      // No registration request: the stop meets the reconciliation the start began.
      const stopping = session.dispose();
      probe.release();

      await expect(stopping).resolves.toBeUndefined();
    } finally {
      await subject.stop();
    }
  },
);

/** Leaves one observation unsettled whose child a reconciliation proves absent. */
async function recordAbsentChild(
  scenario: Awaited<ReturnType<typeof createRepositoryTrustScenario>>,
  subject: Awaited<ReturnType<typeof startAbsenceSubject>>,
) {
  const next = decodeStrict(GitVersionInspectionRequestSchema, {
    ...scenario.stageOne,
    consentId: "707c9723-44df-4a96-9e6e-ce7afce6ae68",
  });
  if (next.consentId === null) throw new Error("Test consent missing");
  await scenario.registry.decideVersion({
    ...next,
    consentId: next.consentId,
    decision: "accepted",
  });
  await recordAbsenceSubject(scenario.registry, next, {
    ...subject.identity,
    creationTime100ns: String(BigInt(subject.identity.creationTime100ns) - 1n),
  });
}

/** Holds the next registry entry check, which runs before a write transaction's permit. */
function holdNextEntryCheck() {
  const entered = switchDeferred<void>();
  const released = switchDeferred<void>();
  const real = filesystem.lstatIfPresent;
  let held = false;
  vi.spyOn(filesystem, "lstatIfPresent").mockImplementation(async (input) => {
    if (!held) {
      held = true;
      entered.resolve();
      await released.promise;
    }
    return real(input);
  });
  return { entered: entered.promise, release: () => released.resolve() };
}

it.runIf(process.platform === "win32" && process.arch === "x64")(
  "holds trust authorization until the start's reconciliation ends",
  async () => {
    const root = await temporaryRoot("p1-restart-trust-");
    roots.push(root);
    const scenario = await createRepositoryTrustScenario(root);
    const subject = await startAbsenceSubject();
    try {
      await scenario.registry.decideRepositoryTrust({ ...scenario.trust, decision: "accepted" });
      await recordAbsentChild(scenario, subject);
      // The reconciliation is held before it takes the write permit.
      const held = holdNextEntryCheck();
      const order: string[] = [];
      const reconciling = scenario.registry
        .reconcileAtStart(absence.createWindowsObserverAbsencePort())
        .then(() => order.push("reconciled"));
      await held.entered;

      const admitting = scenario.registry
        .admitRepositoryIdentityQueries(scenario.admission, { admit: async () => undefined })
        .then((admitted) => {
          order.push("authorized");
          return admitted;
        });
      // An authorization that does not wait answers within milliseconds.
      await Promise.race([admitting, delay(500)]);
      held.release();

      expect(await admitting).toEqual({ status: "admitted" });
      await reconciling;
      expect(order).toEqual(["reconciled", "authorized"]);
    } finally {
      await scenario.observer.close();
      await scenario.registry.stop();
      await subject.stop();
    }
  },
);
