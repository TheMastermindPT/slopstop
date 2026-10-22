import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import {
  CanonicalProjectActivationRequestSchema,
  CanonicalProjectCommandRequestSchema,
  CanonicalProjectSwitchRequestSchema,
  createProjectActivateCommand,
  createProjectCommand,
  createProjectConversationReadCommand,
  createProjectConversationSaveCommand,
  createProjectSwitchCommand,
  decodeStrict,
  MessageIdSchema,
  ProjectConversationReadRequestSchema,
  ProjectConversationSaveRequestSchema,
} from "@slopstop/protocol";
import { createActiveProjectCoordinator } from "../../src/active-project-coordinator.js";
import { createCanonicalProjectApplication } from "../../src/canonical-project-application.js";
import { readProjectConversationReadOnly } from "../../src/conversation/conversation-store.js";
import { startHarnessRuntime } from "../../src/harness-runtime.js";
import { startHarnessProcessRuntime } from "../../src/process-bootstrap.js";
import { createProjectStorageApplication } from "../../src/project-storage-application.js";
import { createUnavailableWorkspaceApplication } from "../../src/workspace-application.js";
import { openReadOnlyClient } from "./conversation-writer-fixture.js";
import {
  checkedInMigrationRoot,
  createUpgradeStorageOwner,
  silentHarnessLogger,
} from "./project-storage-runtime-fixture.js";
import {
  fixtureCoordinatorDependencies,
  recordNoteCommand,
} from "./project-storage-upgrade-fixture.js";
import { causationTransport } from "./project-upgrade-runtime-fixture.js";

function metadata() {
  return {
    messageId: decodeStrict(MessageIdSchema, randomUUID()),
    sentAt: new Date().toISOString(),
  };
}

/** The activation a conversation request addresses. */
export type ConversationTarget = Readonly<{ projectId: string; activationId: string }>;

/** One answer envelope: its event name and its payload. */
type Answer = Readonly<{ event?: unknown; payload?: unknown }>;

type Send = ReturnType<typeof causationTransport>["send"];

/**
 * Runs every cleanup even when one fails; one failure is rethrown, several are reported
 * together (#102: a cleanup failure never replaces another).
 */
async function cleanUpAll(cleanups: readonly (() => Promise<void> | void)[]): Promise<void> {
  const failures: unknown[] = [];
  for (const cleanup of cleanups) {
    try {
      await cleanup();
    } catch (failure) {
      failures.push(failure);
    }
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) throw new AggregateError(failures, "Several cleanups failed.");
}

/**
 * Runs `body`, then the cleanups. A body failure is reported first: with a cleanup failure as
 * well, both are thrown together, the body failure first, never the cleanup failure alone.
 */
export async function runThenCleanUp(
  body: () => Promise<void>,
  ...cleanups: readonly (() => Promise<void> | void)[]
): Promise<void> {
  let bodyFailure: { error: unknown } | undefined;
  try {
    await body();
  } catch (error) {
    bodyFailure = { error };
  }
  try {
    await cleanUpAll(cleanups);
  } catch (cleanupFailure) {
    if (bodyFailure === undefined) throw cleanupFailure;
    throw new AggregateError(
      [bodyFailure.error, cleanupFailure],
      "The test failed, and its cleanup failed too.",
    );
  }
  if (bodyFailure !== undefined) throw bodyFailure.error;
}

/** Project, note and conversation commands over one transport. */
function conversationCommands(send: Send) {
  return {
    activate: (projectId: string): Promise<Answer> =>
      send(
        createProjectActivateCommand(
          metadata(),
          decodeStrict(CanonicalProjectActivationRequestSchema, { projectId }),
        ),
      ),
    switchTo: (from: ConversationTarget, projectId: string): Promise<Answer> =>
      send(
        createProjectSwitchCommand(
          metadata(),
          decodeStrict(CanonicalProjectSwitchRequestSchema, { from, to: { projectId } }),
        ),
      ),
    /** Settles one fixture note (composed runtime only: the process registry has no notes). */
    note: (target: ConversationTarget, note: string): Promise<Answer> =>
      send(
        createProjectCommand(
          metadata(),
          decodeStrict(CanonicalProjectCommandRequestSchema, {
            ...target,
            command: {
              commandId: randomUUID(),
              type: recordNoteCommand.type,
              version: recordNoteCommand.version,
              payload: { note },
            },
          }),
        ),
      ),
    read: (target: ConversationTarget, after: number | null = null): Promise<Answer> =>
      send(
        createProjectConversationReadCommand(
          metadata(),
          decodeStrict(ProjectConversationReadRequestSchema, { ...target, after }),
        ),
      ),
    save: (
      target: ConversationTarget,
      message: Readonly<{ saveId: string; expectedRevision: number; text: string }>,
    ): Promise<Answer> =>
      send(
        createProjectConversationSaveCommand(
          metadata(),
          decodeStrict(ProjectConversationSaveRequestSchema, { ...target, ...message }),
        ),
      ),
  };
}

/** Seam (a): the real process runtime over `root`, with Project and conversation commands. */
export async function startConversationProcessRuntime(root: string) {
  const transport = causationTransport();
  const stop = await startHarnessProcessRuntime({
    logger: silentHarnessLogger,
    bootstrap: {
      kind: "harness.connect",
      applicationStorageRootUrl: pathToFileURL(root).href,
      migrationResourcesRootUrl: pathToFileURL(checkedInMigrationRoot).href,
    },
    transport: transport.harnessSide,
  });
  return {
    ...conversationCommands(transport.send),
    stop: () => cleanUpAll([stop, () => transport.close()]),
  };
}

export type ConversationProcessRuntime = Pick<
  Awaited<ReturnType<typeof startConversationProcessRuntime>>,
  "activate" | "switchTo" | "read" | "save" | "note" | "stop"
>;

const currentTime = () => new Date().toISOString();

/**
 * Seam (b): the harness runtime over a coordinator composed here. Its writer clients go through
 * the upgrade fixture's `faultingClient` (faults, holds, call and close counts) with the fixture
 * note command, and its read-only reads and save reconciliations open through the hooked opener.
 */
export function startComposedConversationRuntime(root: string) {
  const storage = createUpgradeStorageOwner(root).owner;
  const coordinator = createActiveProjectCoordinator({
    ...fixtureCoordinatorDependencies(storage),
    readConversationReadOnly: (input) =>
      readProjectConversationReadOnly({ ...input, openReadOnlyClient }),
    openReconciliationClient: openReadOnlyClient,
  });
  const transport = causationTransport();
  const stopRuntime = startHarnessRuntime({
    transport: transport.harnessSide,
    canonicalProjectApplication: createCanonicalProjectApplication(coordinator),
    projectStorageApplication: createProjectStorageApplication(storage),
    workspaceApplication: createUnavailableWorkspaceApplication(),
    harnessVersion: "0.0.0",
    createId: randomUUID,
    now: currentTime,
  });
  return {
    ...conversationCommands(transport.send),
    coordinator,
    stop: () => cleanUpAll([stopRuntime, () => storage.stop(), () => transport.close()]),
  };
}

/** Activates `projectId` read-write or read-only and answers its target; fails otherwise. */
export async function activeTarget(
  runtime: Pick<ConversationProcessRuntime, "activate">,
  projectId: string,
): Promise<ConversationTarget & Readonly<{ access: string }>> {
  const answer = await runtime.activate(projectId);
  const payload: unknown = answer.payload;
  const status: unknown = Reflect.get(Object(payload), "status");
  const activationId: unknown = Reflect.get(Object(payload), "activationId");
  const access: unknown = Reflect.get(Object(payload), "access");
  const failed = () => new Error(`Activation failed: ${JSON.stringify(payload)}`);
  if (status !== "active") throw failed();
  if (typeof activationId !== "string") throw failed();
  if (typeof access !== "string") throw failed();
  return { projectId, activationId, access };
}
