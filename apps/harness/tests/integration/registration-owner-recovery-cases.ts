import { expect, it } from "vitest";
import { createWindowsObserverAbsencePort } from "../../src/registration/windows-observer-absence.js";
import { createWindowsVersionChild } from "../../src/registration/windows-version-child.js";
import { absenceFaults } from "./registration-absence-fixture.js";
import {
  heldHistoricalChild,
  newVersionRequest,
  recoveringObserver,
} from "./registration-owner-recovery-fixture.js";
import {
  observeAbsenceFault,
  observeIdentityRecovery,
  observeOwnerDeath,
} from "./registration-recovery-scenarios.js";
import {
  createRegistryVersionScenario,
  holdAfterTerminalRecord,
  readObserverRows,
} from "./registration-version-fixture.js";

// Registered only by the agreed public project-registration integration entrypoint.
type OwnerAbsenceObservation = Readonly<{
  freshSelectionId: unknown;
  requests: Readonly<{
    original: unknown;
    fresh: unknown;
    repeatedOriginal: unknown;
    repeatedFresh: unknown;
    before: unknown;
    after: unknown;
  }>;
}>;

/** The original request reconciles as exact owner absence and one fresh request is admitted. */
function expectExactOwnerAbsenceRequests(observed: OwnerAbsenceObservation) {
  expect(observed.requests.original).toEqual({
    status: "broken",
    code: "INTERNAL_FAILURE",
    reconciliation: "exact-owner-absence",
  });
  expect(observed.requests.fresh).toMatchObject({
    status: "prepared",
    selectionId: observed.freshSelectionId,
  });
  expect(observed.requests.repeatedOriginal).toEqual(observed.requests.original);
  expect(observed.requests.repeatedFresh).toEqual(observed.requests.fresh);
  expect([observed.requests.before, observed.requests.after]).toEqual([0, 1]);
}

export function defineOwnerRecoveryCases(createRoot: (prefix: string) => Promise<string>) {
  it("PC-OR recovers after actual observer owner death with durable child identity", async () => {
    const root = await createRoot("pc-s1-owner-death-");
    const observed = await observeOwnerDeath(root, "child-stored");
    expect(observed).toMatchObject({
      point: "child-stored",
      messages: 1,
      children: 1,
      liveChild: { status: "unconfirmed" },
      deadChild: { status: "absent" },
      result: { status: "settled" },
      unsettled: false,
    });
    expectExactOwnerAbsenceRequests(observed);
  }, 15000);

  it.each(["intent", "before-child"] as const)(
    "PC-OR keeps new dispatch closed after actual owner death at %s without durable identity",
    async (checkpoint) => {
      const root = await createRoot("pc-s1-owner-window-");
      const observed = await observeOwnerDeath(root, checkpoint);
      const pending = { status: "pending-recovery", code: "OBSERVER_CLEANUP_UNCONFIRMED" };
      expect(observed).toMatchObject({
        point: checkpoint,
        messages: 1,
        result: pending,
        unsettled: true,
        children: 0,
      });
      expect(observed.requests).toEqual({
        original: pending,
        repeatedOriginal: pending,
        fresh: pending,
        repeatedFresh: pending,
        before: 0,
        after: 0,
      });
      if (checkpoint === "before-child") {
        expect(observed.liveChild).toEqual({ status: "unconfirmed" });
        expect(observed.deadChild).toEqual({ status: "absent" });
      }
    },
    15000,
  );

  it.each([
    {
      point: "before-terminal",
      original: {
        status: "broken",
        code: "INTERNAL_FAILURE",
        reconciliation: "exact-owner-absence",
      },
    },
    { point: "terminal-stored", original: { status: "broken", code: "INTERNAL_FAILURE" } },
    { point: "outcome-stored", original: { status: "prepared" } },
  ] as const)(
    "PC-OR preserves original settlement after actual owner death at $point",
    async ({ point, original }) => {
      const observed = await observeOwnerDeath(await createRoot("pc-s1-owner-terminal-"), point);
      expect(observed).toMatchObject({
        point,
        messages: 1,
        children: 1,
        result: { status: "settled" },
        unsettled: false,
      });
      if (point === "outcome-stored") {
        expect(observed.publishedBeforeDeath).toMatchObject({
          status: "prepared",
          observationId: observed.observationId,
          version: expect.any(String),
        });
        expect(observed.requests.original).toEqual(observed.publishedBeforeDeath);
        expect(observed.requests.repeatedOriginal).toEqual(observed.publishedBeforeDeath);
        expect(observed.persistedAfterRecovery).toEqual(observed.publishedBeforeDeath);
      } else {
        expect(observed.requests.original).toEqual(original);
      }
      expect(observed.requests.fresh).toMatchObject({
        status: "prepared",
        selectionId: observed.freshSelectionId,
      });
      expect(observed.requests.repeatedOriginal).toEqual(observed.requests.original);
      expect(observed.requests.repeatedFresh).toEqual(observed.requests.fresh);
      expect([observed.requests.before, observed.requests.after]).toEqual([0, 1]);
    },
    15000,
  );

  it.each(["exact-live", "wrong-session", "missing-session"] as const)(
    "PC-OR conservatively reconciles controlled %s identity against an owned live process",
    async (variant) => {
      const observed = await observeIdentityRecovery(
        await createRoot("pc-s1-absence-identity-"),
        variant,
      );
      const pending = { status: "pending-recovery", code: "OBSERVER_CLEANUP_UNCONFIRMED" };
      expect(observed).toMatchObject({
        result: pending,
        unsettled: true,
        aliveBefore: true,
        aliveAfter: true,
      });
      expect(observed.requests).toEqual({
        original: pending,
        repeatedOriginal: pending,
        fresh: pending,
        repeatedFresh: pending,
        before: 0,
        after: 0,
      });
    },
    15000,
  );

  it("PC-OR treats historical PID creation as absent without signalling the live replacement", async () => {
    const observed = await observeIdentityRecovery(
      await createRoot("pc-s1-historical-pid-"),
      "historical-creation",
    );
    expect(observed).toMatchObject({
      result: { status: "settled" },
      unsettled: false,
      aliveBefore: true,
      aliveAfter: true,
    });
    expectExactOwnerAbsenceRequests(observed);
  }, 15000);

  it.each(absenceFaults)(
    "PC-OR retains closed admission after controlled %s evidence",
    async (fault) => {
      const observed = await observeAbsenceFault(await createRoot("pc-s1-absence-fault-"), fault);
      expect(observed.result).toEqual({ status: "broken", code: "INTERNAL_FAILURE" });
      expect(observed.hits).toBeGreaterThan(0);
      expect(observed).toMatchObject({
        unsettled: true,
        dispatches: 0,
        outcomes: [],
        alive: true,
      });
      expect(observed.fresh).toEqual({
        status: "pending-recovery",
        code: "OBSERVER_CLEANUP_UNCONFIRMED",
      });
    },
    15000,
  );

  it("PC-OR keeps a live native Job blocking despite a historical creation identity", async () => {
    const root = await createRoot("pc-s1-historical-live-job-");
    const scenario = await heldHistoricalChild(root);
    const observation = scenario.observer.inspectGitVersion(scenario.request);
    try {
      await scenario.owned.promise;
      expect(
        await scenario.registry.reconcileObservers(createWindowsObserverAbsencePort()),
      ).toEqual({ status: "pending-recovery", code: "OBSERVER_CLEANUP_UNCONFIRMED" });
      expect(await scenario.registry.hasUnsettled()).toBe(true);
      scenario.release.resolve();
      expect(await observation).toEqual({
        status: "pending-recovery",
        code: "OBSERVER_CLEANUP_UNCONFIRMED",
        trigger: "INTERNAL_FAILURE",
      });
      expect(
        await scenario.registry.reconcileObservers(createWindowsObserverAbsencePort()),
      ).toEqual({ status: "settled" });
      const fresh = await newVersionRequest(scenario.registry);
      const recovery = recoveringObserver(root, scenario.registry);
      try {
        expect(await recovery.observer.inspectGitVersion(fresh)).toMatchObject({
          status: "prepared",
          selectionId: fresh.selectionId,
        });
        expect(await recovery.observer.inspectGitVersion(scenario.request)).toEqual({
          status: "broken",
          code: "INTERNAL_FAILURE",
          reconciliation: "exact-owner-absence",
        });
        expect(recovery.dispatches()).toBe(1);
      } finally {
        await recovery.observer.close();
      }
    } finally {
      scenario.release.resolve();
      await observation;
      await scenario.observer.close();
      await scenario.registry.stop();
    }
  }, 15000);

  it("PC-OR fences the old publisher after recovery admits a new request", async () => {
    const root = await createRoot("pc-s1-recovery-new-request-");
    const { release, terminalStored, journalFor } = holdAfterTerminalRecord();
    const scenario = await createRegistryVersionScenario(
      root,
      createWindowsVersionChild(root),
      journalFor,
    );
    const observation = scenario.observer.inspectGitVersion(scenario.request);
    const recovery = recoveringObserver(root, scenario.registry);
    try {
      await terminalStored.promise;
      expect(await scenario.registry.reconcileObservers()).toEqual({ status: "settled" });
      const original = { status: "broken", code: "INTERNAL_FAILURE" };
      expect(await recovery.observer.inspectGitVersion(scenario.request)).toEqual(original);
      const fresh = await newVersionRequest(scenario.registry);
      const freshResult = await recovery.observer.inspectGitVersion(fresh);
      expect(freshResult).toMatchObject({ status: "prepared", selectionId: fresh.selectionId });
      release.resolve();
      expect(await observation).not.toMatchObject({ status: "prepared" });
      expect(await recovery.observer.inspectGitVersion(scenario.request)).toEqual(original);
      expect(await recovery.observer.inspectGitVersion(fresh)).toEqual(freshResult);
      expect(recovery.dispatches()).toBe(1);
      expect(await readObserverRows(root, "outcomes")).toHaveLength(2);
    } finally {
      release.resolve();
      await observation;
      await scenario.observer.close();
      await recovery.observer.close();
      await scenario.registry.stop();
    }
  }, 15000);
}
