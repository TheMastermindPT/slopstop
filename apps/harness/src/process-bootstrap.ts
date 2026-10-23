import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decodeStrict, HarnessBootstrapSchema } from "@slopstop/protocol";
import { Cause, Context, Data, Effect, Exit, Fiber, Layer, ManagedRuntime, Result } from "effect";
import type { ActiveProjectCoordinatorWithHeld } from "./active-project-coordinator.js";
import {
  type CanonicalProjectApplication,
  createCanonicalProjectApplication,
} from "./canonical-project-application.js";
import { untypedRejection } from "./effect-rejection.js";
import {
  type HarnessTransport,
  type StopHarnessRuntime,
  startHarnessRuntime,
} from "./harness-runtime.js";
import { createNodeActiveProjectCoordinator } from "./node-active-project-coordinator.js";
import {
  createProjectStorageApplication,
  type ProjectStorageOwner,
} from "./project-storage-application.js";
import type { RegistrationRegistry } from "./registration/registration-registry.js";
import {
  type ApplicationDatabaseAuthority,
  acquireApplicationDatabaseAuthority,
} from "./storage/application-database-authority.js";
import { physicalRoot } from "./storage/physical-root.js";
import { createNodeProjectStorageDependencies } from "./storage/project-storage-node-adapters.js";
import { createProjectStorageOwner } from "./storage/project-storage-store.js";
import type { ProjectStorageUpgradePort } from "./storage/project-storage-upgrade.js";
import {
  createUpgradeDiagnosticsLogger,
  type UpgradeEventLogger,
} from "./upgrade-diagnostics-logger.js";
import { createUnavailableWorkspaceApplication } from "./workspace-application.js";

function trustedRoot(value: string): string {
  const root = path.resolve(fileURLToPath(value));
  if (!path.isAbsolute(root)) {
    throw new Error("Harness bootstrap root must resolve absolutely.");
  }
  return physicalRoot(root);
}

function rootsOverlap(first: string, second: string): boolean {
  const relative = path.relative(first, second);
  return (
    relative === "" ||
    (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  );
}

/** How long a process stop or a failed startup waits for the runtime dispose. */
const HARNESS_RUNTIME_DISPOSE_DEADLINE_MS = 500;

/** A runtime dispose that did not settle by its deadline; it keeps running as the process exits. */
export class HarnessRuntimeDisposeUnconfirmed extends Data.TaggedError(
  "HarnessRuntimeDisposeUnconfirmed",
)<{
  readonly message: string;
  readonly deadlineMs: number;
}> {
  constructor(deadlineMs: number) {
    super({ message: "Harness runtime dispose is unconfirmed.", deadlineMs });
  }
}

type CombinedFailureMessage = "Harness process shutdown failed." | "Harness startup failed.";

/** One failure is reported as is; two are reported together, in order, never replaced. */
function combinedFailure(failures: readonly unknown[], message: CombinedFailureMessage): unknown {
  return failures.length === 1 ? failures[0] : new AggregateError(failures, message);
}

/**
 * Disposes `runtime` and answers its failures, at most one. The dispose closes its scope
 * uninterruptibly, so it runs detached and only the wait for it is bounded: past the deadline
 * it keeps running while the process exits.
 */
function boundedDispose(
  runtime: Pick<ManagedRuntime.ManagedRuntime<unknown, unknown>, "disposeEffect">,
  deadlineMs: number,
): Effect.Effect<readonly unknown[]> {
  return Effect.forkDetach(runtime.disposeEffect).pipe(
    Effect.flatMap(Fiber.await),
    Effect.map((exit) => (Exit.isSuccess(exit) ? [] : [Cause.squash(exit.cause)])),
    Effect.timeoutOrElse({
      duration: deadlineMs,
      orElse: () => Effect.succeed([new HarnessRuntimeDisposeUnconfirmed(deadlineMs)]),
    }),
  );
}

/**
 * Builds one process runtime from `layer` and starts the harness on it. The returned stop runs
 * the program, then a bounded dispose; a startup failure is reported only after a bounded
 * dispose settled. Runs on the global runtime, which outlives the process runtime.
 */
export function launchOnProcessRuntime<Services, LayerError>(
  input: Readonly<{
    layer: Layer.Layer<Services, LayerError>;
    start: (runtime: ManagedRuntime.ManagedRuntime<Services, LayerError>) => StopHarnessRuntime;
    disposeDeadlineMs?: number;
  }>,
): Promise<StopHarnessRuntime> {
  const deadlineMs = input.disposeDeadlineMs ?? HARNESS_RUNTIME_DISPOSE_DEADLINE_MS;
  const runtime = ManagedRuntime.make(input.layer);
  const shutdown = (stopHarness: StopHarnessRuntime) =>
    Effect.gen(function* () {
      const program = yield* Effect.result(
        Effect.tryPromise({ try: () => stopHarness(), catch: untypedRejection }),
      );
      const failures = [
        ...(Result.isFailure(program) ? [program.failure.cause] : []),
        ...(yield* boundedDispose(runtime, deadlineMs)),
      ];
      if (failures.length > 0) {
        return yield* Effect.fail(combinedFailure(failures, "Harness process shutdown failed."));
      }
    });
  return Effect.runPromise(
    Effect.gen(function* () {
      const started = yield* Effect.result(
        Effect.try({ try: () => input.start(runtime), catch: untypedRejection }),
      );
      if (Result.isSuccess(started)) return started.success;
      const disposeFailures = yield* boundedDispose(runtime, deadlineMs);
      return yield* Effect.fail(
        combinedFailure([started.failure.cause, ...disposeFailures], "Harness startup failed."),
      );
    }),
  ).then((stopHarness) => {
    // Built at the Promise edge, after the startup ran: every call shares one stop outcome.
    let disposal: Promise<void> | undefined;
    return () => {
      disposal ??= Effect.runPromise(shutdown(stopHarness));
      return disposal;
    };
  });
}

type HarnessRuntimeIo = Readonly<{
  transport: HarnessTransport;
  /** The process log; upgrade diagnostics of the coordinator's Storage owner go here. */
  logger: UpgradeEventLogger;
}>;

export async function startHarnessProcessRuntime(
  input: HarnessRuntimeIo & Readonly<{ bootstrap: unknown }>,
): Promise<StopHarnessRuntime> {
  return launchHarnessProcessRuntime(checkHarnessBootstrap(input.bootstrap), input);
}

/** Decodes the bootstrap message and checks its roots; it throws before any runtime exists. */
export function checkHarnessBootstrap(message: unknown): HarnessRootPaths {
  const bootstrap = decodeStrict(HarnessBootstrapSchema, message);
  const applicationStorageRoot = trustedRoot(bootstrap.applicationStorageRootUrl);
  const migrationResourcesRoot = trustedRoot(bootstrap.migrationResourcesRootUrl);
  if (
    rootsOverlap(applicationStorageRoot, migrationResourcesRoot) ||
    rootsOverlap(migrationResourcesRoot, applicationStorageRoot)
  ) {
    throw new Error("Harness bootstrap roots must not overlap.");
  }
  return { applicationStorageRoot, migrationResourcesRoot };
}

export function launchHarnessProcessRuntime(
  roots: HarnessRootPaths,
  input: HarnessRuntimeIo,
): Promise<StopHarnessRuntime> {
  // One runtime per harness process builds the owners once, sharing one application
  // database authority. Their shutdown order stays explicit in the harness runtime.
  return launchOnProcessRuntime({
    layer: harnessServicesLayer(roots, input.logger),
    start: (runtime) => {
      const services = runtime.runSync(
        Effect.gen(function* () {
          return {
            applicationDatabase: yield* ApplicationDatabase,
            projectStorage: yield* ProjectStorage,
            registration: yield* ProjectRegistration,
            canonicalProjects: yield* CanonicalProjects,
          };
        }),
      );
      const { registration } = services;
      return startHarnessRuntime({
        projectRegistration: withListRemoval(
          registration.flow,
          createListRemoval({
            options: registration.options,
            withHeldProject: services.canonicalProjects.withHeldProject,
          }),
        ),
        projectListing: createRegistrationListing(registration),
        applicationDatabase: services.applicationDatabase,
        transport: input.transport,
        canonicalProjectApplication: services.canonicalProjects,
        workspaceApplication: createUnavailableWorkspaceApplication(),
        projectStorageApplication: createProjectStorageApplication(services.projectStorage),
        harnessVersion: "0.0.0",
        createId: randomUUID,
        now: currentTime,
        runtime,
      });
    },
  });
}

const currentTime = () => new Date().toISOString();

type HarnessRootPaths = Readonly<{
  applicationStorageRoot: string;
  migrationResourcesRoot: string;
}>;

/** Where the coordinator's Storage owner reports its upgrade diagnostics. */
class UpgradeLog extends Context.Service<UpgradeLog, UpgradeEventLogger>()(
  "slopstop/harness/UpgradeLog",
) {}
class HarnessRoots extends Context.Service<HarnessRoots, HarnessRootPaths>()(
  "slopstop/harness/HarnessRoots",
) {}
/** The harness process's one shared application database authority, built by its Layer. */
export class ApplicationDatabase extends Context.Service<
  ApplicationDatabase,
  ApplicationDatabaseAuthority
>()("slopstop/harness/ApplicationDatabase") {}
class ProjectStorage extends Context.Service<
  ProjectStorage,
  ProjectStorageOwner & ProjectStorageUpgradePort
>()("slopstop/harness/ProjectStorage") {}
class ProjectRegistration extends Context.Service<
  ProjectRegistration,
  Readonly<{
    registry: RegistrationRegistry;
    owner: ReturnType<typeof createProjectRegistrationOwner>;
    observer: ProjectRegistrationObserver;
    flow: ProjectRegistrationFlow;
    options: RegistrationDatabaseOptions;
  }>
>()("slopstop/harness/ProjectRegistration") {}
class CanonicalProjects extends Context.Service<
  CanonicalProjects,
  CanonicalProjectApplication & Pick<ActiveProjectCoordinatorWithHeld, "withHeldProject">
>()("slopstop/harness/CanonicalProjects") {}

const applicationDatabaseLayer = Layer.effect(
  ApplicationDatabase,
  Effect.gen(function* () {
    // Scoped: disposing the runtime closes an authority the shutdown never stopped or withheld.
    return yield* acquireApplicationDatabaseAuthority(yield* HarnessRoots);
  }),
);

const projectStorageLayer = Layer.effect(
  ProjectStorage,
  Effect.gen(function* () {
    const roots = yield* HarnessRoots;
    return createProjectStorageOwner(
      createNodeProjectStorageDependencies({
        ...roots,
        applicationVersion: "0.0.0",
        applicationDatabase: yield* ApplicationDatabase,
        upgradeDiagnostics: createUpgradeDiagnosticsLogger(yield* UpgradeLog),
      }),
    );
  }),
);

const projectRegistrationLayer = Layer.effect(
  ProjectRegistration,
  Effect.gen(function* () {
    const roots = yield* HarnessRoots;
    const options = {
      ...roots,
      applicationVersion: "0.0.0",
      applicationDatabase: yield* ApplicationDatabase,
    };
    const selection = createDirectoryHandoff();
    const registry = createRegistrationRegistry(options, selection.port);
    const observer = createProjectRegistrationObserver(
      createGitVersionInspection(
        registry,
        createVersionObservationExecution({
          inspectIdentity: observeSelectedExecutable,
          journal: registry,
          child: createWindowsVersionChild(roots.applicationStorageRoot),
        }),
      ),
      registry,
    );
    const owner = createProjectRegistrationOwner(registry, options, roots.applicationStorageRoot);
    return {
      registry,
      owner,
      observer,
      options,
      flow: createProjectRegistrationFlow({
        registry,
        observer,
        selection,
        discoverGit: () => discoverGitExecutable(process.env),
        createId: randomUUID,
        owner,
        options,
      }),
    };
  }),
);

const canonicalProjectsLayer = Layer.effect(
  CanonicalProjects,
  Effect.gen(function* () {
    const roots = yield* HarnessRoots;
    const applicationDatabase = yield* ApplicationDatabase;
    const registryOptions = { ...roots, applicationDatabase };
    const coordinator = createNodeActiveProjectCoordinator({
      validateTarget: createRegisteredProjectTargetValidation(registryOptions),
      validateSession: createRegisteredProjectSessionValidation(registryOptions),
      storage: yield* ProjectStorage,
    });
    return {
      ...createCanonicalProjectApplication(coordinator),
      withHeldProject: coordinator.withHeldProject,
    };
  }),
);

/**
 * The harness process's application Layer: the owners built once for its one runtime, sharing
 * one application database authority.
 */
export function harnessServicesLayer(roots: HarnessRootPaths, upgradeLog: UpgradeEventLogger) {
  return canonicalProjectsLayer.pipe(
    Layer.provideMerge(Layer.mergeAll(projectStorageLayer, projectRegistrationLayer)),
    Layer.provideMerge(applicationDatabaseLayer),
    Layer.provideMerge(Layer.succeed(HarnessRoots, roots)),
    Layer.provideMerge(Layer.succeed(UpgradeLog, upgradeLog)),
  );
}

import {
  createProjectRegistrationObserver,
  type ProjectRegistrationObserver,
} from "./project-registration-observer.js";
import { discoverGitExecutable } from "./registration/git-executable-discovery.js";
import { createGitVersionInspection } from "./registration/git-version-inspection.js";
import { createListRemoval, withListRemoval } from "./registration/list-visibility.js";
import {
  createDirectoryHandoff,
  createProjectRegistrationFlow,
  type ProjectRegistrationFlow,
} from "./registration/project-registration-flow.js";
import { createProjectRegistrationOwner } from "./registration/project-registration-owner.js";
import {
  createRegisteredProjectSessionValidation,
  createRegisteredProjectTargetValidation,
} from "./registration/registered-project-selection.js";
import { createRegistrationListing } from "./registration/registration-listing.js";
import { createRegistrationRegistry } from "./registration/registration-registry.js";
import type { RegistrationDatabaseOptions } from "./registration/registry-database.js";
import { createVersionObservationExecution } from "./registration/version-observation-execution.js";
import { createWindowsVersionChild } from "./registration/windows-version-child.js";
import { observeSelectedExecutable } from "./storage/repository-identity-observer.js";
