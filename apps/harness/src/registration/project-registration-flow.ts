import {
  decodeStrict,
  decodeStrictResult,
  type ProjectRegistrationRequest,
  type ProjectRegistrationResult,
  ProjectRegistrationResultSchema,
} from "@slopstop/protocol";
import { Effect, Result, Semaphore } from "effect";
import {
  GitVersionInspectionRequestSchema,
  type ProjectRegistrationObserver,
} from "../project-registration-observer.js";
import { IdentityQueryConsentRequestSchema } from "./identity-query-consent.js";
import { createProposalSteps, type ProposalOwner } from "./registration-proposal-steps.js";
import type { RegistrationRegistry } from "./registration-registry.js";
import {
  failureOf,
  internalFailure,
  type RegistrationStepDefect,
  step,
} from "./registration-step.js";
import type { RegistrationDatabaseOptions } from "./registry-database.js";
import {
  type NativeRepositorySelectionPort,
  RepositoryTrustDecisionSchema,
} from "./repository-trust.js";

/**
 * Hands the directory chosen by the desktop main process to the registry's selection port
 * for exactly one selection.
 */
export function createDirectoryHandoff() {
  let offered: string | undefined;
  const port: NativeRepositorySelectionPort = {
    select: async () => {
      const directory = offered;
      offered = undefined;
      return directory === undefined ? { status: "cancelled" } : { status: "selected", directory };
    },
  };
  return { port, offer: (directory: string) => (offered = directory) };
}

export type DirectoryHandoff = ReturnType<typeof createDirectoryHandoff>;

export interface ProjectRegistrationFlow {
  handle(request: ProjectRegistrationRequest): Effect.Effect<ProjectRegistrationResult>;
}

export function createProjectRegistrationFlow(
  dependencies: Readonly<{
    registry: RegistrationRegistry;
    observer: ProjectRegistrationObserver;
    selection: DirectoryHandoff;
    gitExecutablePath: string;
    createId: () => string;
    owner: ProposalOwner;
    options: RegistrationDatabaseOptions;
  }>,
): ProjectRegistrationFlow {
  const { registry, observer, selection } = dependencies;
  const proposals = createProposalSteps(dependencies);

  const selectRepository = (directory: string) =>
    Effect.map(
      step(() => {
        selection.offer(directory);
        return registry.selectRepository();
      }),
      (selected): ProjectRegistrationResult =>
        selected.status === "prepared"
          ? {
              status: "repository-selected",
              repositorySelectionId: selected.repositorySelectionId,
            }
          : failureOf(selected),
    );

  const decideTrust = (request: Extract<ProjectRegistrationRequest, { step: "decide-trust" }>) =>
    Effect.map(
      step(() =>
        registry.decideRepositoryTrust(
          decodeStrict(RepositoryTrustDecisionSchema, {
            repositorySelectionId: request.repositorySelectionId,
            trustId: request.trustId,
            decision: request.decision,
          }),
        ),
      ),
      (recorded): ProjectRegistrationResult =>
        recorded.status === "recorded" ? { status: "trust-recorded" } : failureOf(recorded),
    );

  const prepareGit = Effect.suspend(() => {
    const { selectionId } = decodeStrict(GitVersionInspectionRequestSchema, {
      selectionId: dependencies.createId(),
      consentId: null,
    });
    return Effect.map(
      step(() =>
        registry.prepareExecutable({
          selectionId,
          executablePath: dependencies.gitExecutablePath,
        }),
      ),
      (prepared): ProjectRegistrationResult =>
        prepared.status === "prepared"
          ? {
              status: "git-prepared",
              selectionId: prepared.selectionId,
              executablePath: dependencies.gitExecutablePath,
            }
          : failureOf(prepared),
    );
  });

  const decideGitVersion = (
    request: Extract<ProjectRegistrationRequest, { step: "decide-git-version" }>,
  ) =>
    Effect.gen(function* () {
      const inspection = decodeStrict(GitVersionInspectionRequestSchema, {
        selectionId: request.selectionId,
        consentId: request.consentId,
      });
      if (inspection.consentId === null) return internalFailure;
      const consentId = inspection.consentId;
      const recorded = yield* step(() =>
        registry.decideVersion({
          selectionId: inspection.selectionId,
          consentId,
          decision: request.decision,
        }),
      );
      if (recorded.status !== "recorded") return failureOf(recorded);
      if (request.decision === "declined") return { status: "cancelled" } as const;
      const observed = yield* step(() => observer.inspectGitVersion(inspection));
      return observed.status === "prepared"
        ? ({
            status: "git-version-observed",
            selectionId: observed.selectionId,
            observationId: observed.observationId,
            version: observed.version,
          } as const)
        : failureOf(observed);
    });

  const decideIdentityQueries = (
    request: Extract<ProjectRegistrationRequest, { step: "decide-identity-queries" }>,
  ) =>
    Effect.map(
      step(() =>
        registry.decideIdentityQueries({
          ...decodeStrict(IdentityQueryConsentRequestSchema, {
            selectionId: request.selectionId,
            observationId: request.observationId,
            consentId: request.consentId,
          }),
          decision: request.decision,
        }),
      ),
      (recorded): ProjectRegistrationResult => {
        if (recorded.status !== "recorded") return failureOf(recorded);
        return request.decision === "declined"
          ? { status: "cancelled" }
          : { status: "identity-queries-recorded" };
      },
    );

  const dispatch = (
    request: ProjectRegistrationRequest,
  ): Effect.Effect<ProjectRegistrationResult, RegistrationStepDefect> => {
    switch (request.step) {
      case "select-repository":
        return selectRepository(request.directory);
      case "decide-trust":
        return decideTrust(request);
      case "prepare-git":
        return prepareGit;
      case "decide-git-version":
        return decideGitVersion(request);
      case "decide-identity-queries":
        return decideIdentityQueries(request);
      case "prepare":
        return proposals.prepare(request);
      case "confirm":
        return proposals.confirm(request);
    }
  };

  // One step at a time: the selection handoff and the consent stages are sequential.
  const steps = Semaphore.makeUnsafe(1);
  return {
    handle: (request) =>
      dispatch(request).pipe(
        Effect.catchTag("RegistrationStepDefect", () => Effect.succeed(internalFailure)),
        Effect.map((result) => {
          const decoded = decodeStrictResult(ProjectRegistrationResultSchema, result);
          return Result.isSuccess(decoded) ? decoded.success : internalFailure;
        }),
        Semaphore.withPermit(steps),
      ),
  };
}
