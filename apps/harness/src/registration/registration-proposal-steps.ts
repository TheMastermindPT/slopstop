import {
  decodeStrict,
  type ProjectRegistrationRequest,
  type ProjectRegistrationResult,
} from "@slopstop/protocol";
import { Effect } from "effect";
import {
  type ExistingRegistration,
  inspectProposal,
  type ProposalInspection,
} from "./existing-registration.js";
import { registeredName } from "./registered-name.js";
import { ConfirmationValidationRequestSchema } from "./registration-confirmation-store.js";
import { PrepareProjectRegistrationSchema } from "./registration-proposal-store.js";
import {
  failureOf,
  type RegistrationStepDefect,
  type RegistrationStepFailure,
  step,
} from "./registration-step.js";
import type { RegistrationDatabaseOptions } from "./registry-database.js";

type PrepareRequest = Extract<ProjectRegistrationRequest, { step: "prepare" | "confirm" }>;
type ConfirmRequest = Extract<ProjectRegistrationRequest, { step: "confirm" }>;
type OwnerResult = Readonly<{ status: string; code?: string; projectId?: string }>;

/** The registration owner's proposal operations, as the harness already exposes them. */
export interface ProposalOwner {
  prepare(request: unknown): Promise<OwnerResult & { proposalId?: string }>;
  confirm(request: unknown): Promise<OwnerResult>;
}

function preparationOf(request: PrepareRequest) {
  return decodeStrict(PrepareProjectRegistrationSchema, {
    version: 1,
    requestId: request.preparationRequestId,
    admission: {
      selectionId: request.selectionId,
      observationId: request.observationId,
      consentId: request.consentId,
      repositorySelectionId: request.repositorySelectionId,
      trustId: request.trustId,
    },
  });
}

function existingResult(
  existing: Exclude<ExistingRegistration, { status: "none" }>,
): ProjectRegistrationResult {
  if (existing.status === "incomplete")
    return { status: "pending-recovery", code: "REGISTRATION_INCOMPLETE" };
  const named = { projectId: existing.projectId, name: existing.name };
  if (existing.status !== "belongs-to-project") return { status: existing.status, ...named };
  return existing.hidden
    ? { status: existing.status, ...named, hiddenFromList: true }
    : { status: existing.status, ...named };
}

function proposalResult(
  { proposal }: ProposalInspection,
  fingerprint: string,
): ProjectRegistrationResult {
  return {
    status: "proposal-prepared",
    proposalId: proposal.proposalId,
    proposalFingerprint: fingerprint,
    name: registeredName(proposal.observation.paths.worktree),
    repositoryDirectory: proposal.authority.repositoryDirectory,
    worktree: proposal.observation.paths.worktree,
    gitVersion: proposal.authority.executable.version,
  };
}

type Inspected = ProposalInspection | RegistrationStepFailure;

function preparedOutcome(inspected: Inspected, fingerprint: string): ProjectRegistrationResult {
  if (!("proposal" in inspected)) return inspected;
  return inspected.existing.status === "none"
    ? proposalResult(inspected, fingerprint)
    : existingResult(inspected.existing);
}

// A late race on the same common directory maps like preparation does.
function confirmedOutcome(confirmed: OwnerResult, inspected: Inspected): ProjectRegistrationResult {
  if (!("proposal" in inspected)) return inspected;
  const { existing } = inspected;
  if (existing.status === "none" || existing.status === "incomplete") return failureOf(confirmed);
  return confirmed.status === "registered"
    ? { status: "registered", projectId: existing.projectId, name: existing.name }
    : existingResult(existing);
}

/**
 * Prepare and confirm over the existing registration owner. A folder whose common directory
 * is already reserved is answered at preparation, so returning it never confirms again.
 */
export function createProposalSteps(
  dependencies: Readonly<{ owner: ProposalOwner; options: RegistrationDatabaseOptions }>,
) {
  const inspect = (request: PrepareRequest) =>
    inspectProposal(dependencies.options, preparationOf(request)).pipe(
      Effect.catchTag("RegistryReadFailed", (failed) => Effect.succeed(failureOf(failed.failure))),
    );

  const prepare = (
    request: Extract<ProjectRegistrationRequest, { step: "prepare" }>,
  ): Effect.Effect<ProjectRegistrationResult, RegistrationStepDefect> =>
    Effect.gen(function* () {
      const prepared = yield* step(() => dependencies.owner.prepare(preparationOf(request)));
      if (prepared.status !== "prepared" || !("proposalFingerprint" in prepared))
        return failureOf(prepared);
      const fingerprint = String(prepared.proposalFingerprint);
      return preparedOutcome(yield* inspect(request), fingerprint);
    });

  const confirm = (
    request: ConfirmRequest,
  ): Effect.Effect<ProjectRegistrationResult, RegistrationStepDefect> =>
    Effect.gen(function* () {
      const confirmation = decodeStrict(ConfirmationValidationRequestSchema, {
        version: 1,
        requestId: request.requestId,
        preparation: preparationOf(request),
        proposalId: request.proposalId,
        proposalFingerprint: request.proposalFingerprint,
      });
      const confirmed = yield* step(() => dependencies.owner.confirm(confirmation));
      if (confirmed.status !== "registered" && confirmed.status !== "requires-project-selection")
        return failureOf(confirmed);
      return confirmedOutcome(confirmed, yield* inspect(request));
    });

  return { prepare, confirm };
}
