import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { MessageChannel } from "node:worker_threads";
import {
  CanonicalProjectActivationRequestSchema,
  CanonicalProjectCommandRequestSchema,
  createProjectActivateCommand,
  createProjectCommand,
  createProjectListCommand,
  createProjectUpgradeCommand,
  decodeStrict,
  MessageIdSchema,
  ProjectListResultSchema,
  ProjectUpgradeRequestSchema,
} from "@slopstop/protocol";
import { createCanonicalProjectApplication } from "../../src/canonical-project-application.js";
import { startHarnessRuntime } from "../../src/harness-runtime.js";
import { createNodeActiveProjectCoordinator } from "../../src/node-active-project-coordinator.js";
import { startHarnessProcessRuntime } from "../../src/process-bootstrap.js";
import { createProjectStorageApplication } from "../../src/project-storage-application.js";
import { listRegisteredProjects } from "../../src/registration/project-listing.js";
import {
  createUpgradeDiagnosticsLogger,
  type UpgradeEventLogger,
} from "../../src/upgrade-diagnostics-logger.js";
import { createUnavailableWorkspaceApplication } from "../../src/workspace-application.js";
import {
  checkedInMigrationRoot,
  createUpgradeStorageOwner,
  silentHarnessLogger,
  transportFor,
  type UpgradeOwnerOptions,
} from "./project-storage-runtime-fixture.js";

type Envelope = Readonly<{ causationId?: unknown; event?: unknown; payload?: unknown }>;

/** A harness transport over a message channel whose answers are matched by `causationId`. */
export function causationTransport() {
  const { port1, port2 } = new MessageChannel();
  const received: Envelope[] = [];
  const waiters = new Map<string, (message: Envelope) => void>();
  port2.on("message", (message: Envelope) => {
    received.push(message);
    const waiter = typeof message.causationId === "string" && waiters.get(message.causationId);
    if (waiter) waiter(message);
  });
  const send = (message: Readonly<{ messageId: string }>): Promise<Envelope> => {
    const answer = new Promise<Envelope>((resolve) => waiters.set(message.messageId, resolve));
    port2.postMessage(message);
    return answer;
  };
  return {
    harnessSide: transportFor(port1),
    received,
    send,
    close: () => {
      port1.close();
      port2.close();
    },
  };
}

function metadata() {
  return {
    messageId: decodeStrict(MessageIdSchema, randomUUID()),
    sentAt: new Date().toISOString(),
  };
}

/** Sends one command and answers its result envelope. */
function projectCommands(send: ReturnType<typeof causationTransport>["send"]) {
  return {
    activate: (projectId: string) =>
      send(
        createProjectActivateCommand(
          metadata(),
          decodeStrict(CanonicalProjectActivationRequestSchema, { projectId }),
        ),
      ),
    list: () => send(createProjectListCommand(metadata())),
    command: (projectId: string) =>
      send(
        createProjectCommand(
          metadata(),
          decodeStrict(CanonicalProjectCommandRequestSchema, {
            projectId,
            activationId: randomUUID(),
            command: { commandId: randomUUID(), type: "fixture.noop", version: 1, payload: {} },
          }),
        ),
      ),
    upgrade: (projectId: string) =>
      send(
        createProjectUpgradeCommand(
          metadata(),
          decodeStrict(ProjectUpgradeRequestSchema, { projectId }),
        ),
      ),
  };
}

/** Seam (a): the real process runtime over a temporary application root. */
export function startRealUpgradeRuntime(
  root: string,
  logger: UpgradeEventLogger = silentHarnessLogger,
) {
  const transport = causationTransport();
  const stop = startHarnessProcessRuntime({
    logger,
    bootstrap: {
      kind: "harness.connect",
      applicationStorageRootUrl: pathToFileURL(root).href,
      migrationResourcesRootUrl: pathToFileURL(checkedInMigrationRoot).href,
    },
    transport: transport.harnessSide,
  });
  return {
    ...projectCommands(transport.send),
    received: transport.received,
    stop: async () => {
      try {
        await stop();
      } finally {
        transport.close();
      }
    },
  };
}

const currentTime = () => new Date().toISOString();

/**
 * Seam (b): the harness runtime over a test-composed coordinator whose storage is the upgrade
 * fixture (faults and attempt ids armed by its wrapper), a listing over the same root, and,
 * when `other` is given, activations of `other.projectId` routed to that second root.
 */
export function startTestUpgradeRuntime(
  root: string,
  options: UpgradeOwnerOptions & {
    other?: Readonly<{ root: string; projectId: string }>;
    logger?: UpgradeEventLogger;
  } = {},
) {
  const fixture = createUpgradeStorageOwner(root, {
    ...options,
    upgradeDiagnostics: createUpgradeDiagnosticsLogger(options.logger ?? silentHarnessLogger),
  });
  const other = options.other;
  const otherOwner = other === undefined ? undefined : createUpgradeStorageOwner(other.root);
  // What Storage answered the coordinator, observable even after the transport has closed.
  const storageAnswers: unknown[] = [];
  const recorded = async <Answer>(answer: Promise<Answer>): Promise<Answer> => {
    const settled = await answer;
    storageAnswers.push(settled);
    return settled;
  };
  const coordinator = createNodeActiveProjectCoordinator({
    storage: {
      acquireActivation: (request) =>
        recorded(
          otherOwner !== undefined && request.projectId === other?.projectId
            ? otherOwner.owner.acquireActivation(request)
            : fixture.owner.acquireActivation(request),
        ),
      upgrade: (request) => recorded(fixture.upgrade(request)),
    },
  });
  // Resolves once the coordinator has taken in an activation (queued behind a running upgrade).
  let activationAdmitted = (): void => undefined;
  const firstActivationAdmitted = new Promise<void>((resolve) => {
    activationAdmitted = resolve;
  });
  const admitting: typeof coordinator = {
    ...coordinator,
    activate: (request) => {
      activationAdmitted();
      return coordinator.activate(request);
    },
  };
  const transport = causationTransport();
  const listingOptions = {
    applicationStorageRoot: root,
    migrationResourcesRoot: checkedInMigrationRoot,
    applicationVersion: "0.0.0",
  };
  const stopRuntime = startHarnessRuntime({
    transport: transport.harnessSide,
    canonicalProjectApplication: createCanonicalProjectApplication(admitting),
    // The upgrade fixture's owner, so the runtime stops it as the process runtime does.
    projectStorageApplication: createProjectStorageApplication(fixture.owner),
    workspaceApplication: createUnavailableWorkspaceApplication(),
    projectListing: {
      list: async () =>
        decodeStrict(
          ProjectListResultSchema,
          await listRegisteredProjects(listingOptions, new AbortController().signal),
        ),
      stop: async () => undefined,
    },
    harnessVersion: "0.0.0",
    createId: randomUUID,
    now: currentTime,
  });
  return {
    ...projectCommands(transport.send),
    fixture,
    storageAnswers,
    firstActivationAdmitted,
    received: transport.received,
    stop: async () => {
      try {
        await stopRuntime();
      } finally {
        await fixture.owner.stop();
        await otherOwner?.owner.stop();
        transport.close();
      }
    },
  };
}
