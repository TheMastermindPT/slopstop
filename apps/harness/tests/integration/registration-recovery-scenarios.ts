import path from "node:path";
import type { GitVersionInspectionRequest } from "../../src/project-registration-observer.js";
import { createRegistrationRegistry } from "../../src/registration/registration-registry.js";
import { createWindowsObserverAbsencePort } from "../../src/registration/windows-observer-absence.js";
import { createWorkerLocalLibsqlClient } from "../../src/storage/local-libsql-worker-client.js";
import {
  type absenceFaults,
  injectAbsenceFault,
  recordAbsenceSubject,
  startAbsenceSubject,
} from "./registration-absence-fixture.js";
import {
  newVersionRequest,
  type ownerCheckpoints,
  recoveringObserver,
  startObserverOwner,
} from "./registration-owner-recovery-fixture.js";
import { createStoredVersionConsent, readObserverRows } from "./registration-version-fixture.js";

async function inspectRecoveryRequests(
  recovery: ReturnType<typeof recoveringObserver>,
  requests: { original: GitVersionInspectionRequest; fresh: GitVersionInspectionRequest },
) {
  const original = await recovery.observer.inspectGitVersion(requests.original);
  const before = recovery.dispatches();
  const fresh = await recovery.observer.inspectGitVersion(requests.fresh);
  const repeatedOriginal = await recovery.observer.inspectGitVersion(requests.original);
  const repeatedFresh = await recovery.observer.inspectGitVersion(requests.fresh);
  return { original, before, fresh, repeatedOriginal, repeatedFresh, after: recovery.dispatches() };
}

async function readStoredObserverOutcome(root: string, observationId: string): Promise<unknown> {
  const client = createWorkerLocalLibsqlClient(path.join(root, "application.db"), "application");
  try {
    const result = await client.execute({
      sql: "SELECT result_json FROM registration_observer_outcomes WHERE observation_id = ?",
      args: [observationId],
    });
    const json = result.rows[0]?.[0];
    if (result.rows.length !== 1 || typeof json !== "string") {
      throw new Error("Expected exactly one durable observer outcome.");
    }
    // Keep every stored field; do not reconstruct a baseline from a recovery response/schema.
    const outcome: unknown = JSON.parse(json);
    return outcome;
  } finally {
    await client.close();
  }
}

export async function observeOwnerDeath(
  root: string,
  checkpoint: (typeof ownerCheckpoints)[number],
) {
  const stored = await createStoredVersionConsent(root);
  await stored.registry.stop();
  const peer = await startObserverOwner(root, checkpoint, stored.request);
  const registry = createRegistrationRegistry({
    applicationStorageRoot: root,
    migrationResourcesRoot: path.resolve(import.meta.dirname, "../../drizzle"),
  });
  const recovery = recoveringObserver(root, registry);
  const absence = createWindowsObserverAbsencePort();
  try {
    const liveChild =
      peer.reached.identity === undefined
        ? undefined
        : await absence.inspect(peer.reached.identity);
    const publishedBeforeDeath =
      checkpoint === "outcome-stored"
        ? await readStoredObserverOutcome(root, peer.reached.observationId)
        : undefined;
    await peer.kill();
    const deadChild =
      peer.reached.identity === undefined
        ? undefined
        : await absence.inspect(peer.reached.identity);
    const result = await registry.reconcileObservers(absence);
    const unsettled = await registry.hasUnsettled();
    const children = await readObserverRows(root, "children");
    const fresh = await newVersionRequest(registry);
    const requests = await inspectRecoveryRequests(recovery, { original: stored.request, fresh });
    const persistedAfterRecovery =
      checkpoint === "outcome-stored"
        ? await readStoredObserverOutcome(root, peer.reached.observationId)
        : undefined;
    return {
      point: peer.reached.point,
      observationId: peer.reached.observationId,
      messages: peer.messages.length,
      liveChild,
      deadChild,
      result,
      unsettled,
      children: children.length,
      freshSelectionId: fresh.selectionId,
      requests,
      publishedBeforeDeath,
      persistedAfterRecovery,
    };
  } finally {
    await peer.kill();
    await recovery.observer.close();
    await registry.stop();
  }
}

export type IdentityVariant =
  | "exact-live"
  | "wrong-session"
  | "missing-session"
  | "historical-creation";
function identityVariant(
  subject: Awaited<ReturnType<typeof startAbsenceSubject>>,
  variant: IdentityVariant,
) {
  const { sessionId, ...withoutSession } = subject.identity;
  if (variant === "missing-session") return withoutSession;
  return {
    ...subject.identity,
    sessionId: variant === "wrong-session" ? sessionId + 1 : sessionId,
    // Deliberately historical fixture, not physically forced OS PID reuse.
    creationTime100ns:
      variant === "historical-creation"
        ? String(BigInt(subject.identity.creationTime100ns) - 1n)
        : subject.identity.creationTime100ns,
  };
}

export async function observeIdentityRecovery(root: string, variant: IdentityVariant) {
  const { registry, request } = await createStoredVersionConsent(root);
  const subject = await startAbsenceSubject();
  const recovery = recoveringObserver(root, registry);
  try {
    await recordAbsenceSubject(registry, request, identityVariant(subject, variant));
    const fresh = await newVersionRequest(registry);
    const aliveBefore = subject.alive();
    const result = await registry.reconcileObservers(createWindowsObserverAbsencePort());
    const unsettled = await registry.hasUnsettled();
    const requests = await inspectRecoveryRequests(recovery, { original: request, fresh });
    return {
      result,
      unsettled,
      requests,
      aliveBefore,
      aliveAfter: subject.alive(),
      freshSelectionId: fresh.selectionId,
    };
  } finally {
    await recovery.observer.close();
    await subject.stop();
    await registry.stop();
  }
}

export async function observeAbsenceFault(root: string, fault: (typeof absenceFaults)[number]) {
  const { registry, request } = await createStoredVersionConsent(root);
  const subject = await startAbsenceSubject();
  const recovery = recoveringObserver(root, registry);
  try {
    await recordAbsenceSubject(registry, request, identityVariant(subject, "historical-creation"));
    const fresh = await newVersionRequest(registry);
    const injected = injectAbsenceFault(fault);
    let result: Awaited<ReturnType<typeof registry.reconcileObservers>>;
    try {
      result = await registry.reconcileObservers(createWindowsObserverAbsencePort());
    } finally {
      injected.restore();
    }
    return {
      result,
      hits: injected.hits(),
      unsettled: await registry.hasUnsettled(),
      fresh: await recovery.observer.inspectGitVersion(fresh),
      dispatches: recovery.dispatches(),
      outcomes: await readObserverRows(root, "outcomes"),
      alive: subject.alive(),
    };
  } finally {
    await recovery.observer.close();
    await subject.stop();
    await registry.stop();
  }
}
