import { Effect } from "effect";
import { readHiddenProjectIds, showProject } from "./list-visibility.js";
import { samePhysicalIdentity } from "./physical-identity.js";
import { registeredName } from "./registered-name.js";
import {
  findCommonReservation,
  type Reservation,
  readPublication,
} from "./registration-confirmation-store.js";
import {
  type PrepareProjectRegistration,
  type RegistrationProposalRecord,
  readProposal,
} from "./registration-proposal-store.js";
import type { RegistrationDatabaseOptions } from "./registry-database.js";
import { RegistryReadFailed, registryRead, withRegistryTransaction } from "./registry-effect.js";

/** How a prepared proposal relates to a Project already reserved for its common directory. */
export type ExistingRegistration =
  | Readonly<{ status: "none" }>
  | Readonly<{ status: "incomplete" }>
  | Readonly<{
      status: "already-registered" | "restored-to-list" | "belongs-to-project";
      projectId: Reservation["projectId"];
      name: string;
      /** The Project was removed from the saved list (a linked worktree leaves it hidden). */
      hidden: boolean;
    }>;

export type ProposalInspection = Readonly<{
  proposal: RegistrationProposalRecord;
  existing: ExistingRegistration;
}>;

function relation(sameFolder: boolean, hidden: boolean) {
  if (!sameFolder) return "belongs-to-project" as const;
  return hidden ? ("restored-to-list" as const) : ("already-registered" as const);
}

const corrupt = new RegistryReadFailed({
  failure: { status: "broken", code: "REGISTRY_CORRUPT" },
});

/**
 * Reads a saved proposal and the reservation for its common directory without writing.
 * The same worktree is the registered folder again; another worktree of that common
 * directory is a linked worktree of the Project (B1). A reservation without publication is
 * an interrupted registration (B2).
 */
export function inspectProposal(
  options: RegistrationDatabaseOptions,
  preparation: PrepareProjectRegistration,
): Effect.Effect<ProposalInspection, RegistryReadFailed> {
  return withRegistryTransaction(options, (transaction) =>
    Effect.gen(function* () {
      const proposal = yield* registryRead(transaction, (read) => readProposal(read, preparation));
      if (proposal === undefined) return yield* Effect.fail(corrupt);
      const reservation = yield* registryRead(transaction, (read) =>
        findCommonReservation(read, proposal),
      );
      if (reservation === undefined) return { proposal, existing: { status: "none" } } as const;
      const publication = yield* registryRead(transaction, (read) =>
        readPublication(read, reservation),
      );
      if (publication === undefined)
        return { proposal, existing: { status: "incomplete" } } as const;
      const registered = reservation.proposal.observation;
      const sameFolder = samePhysicalIdentity(
        registered.physical.worktree,
        proposal.observation.physical.worktree,
      );
      const hidden = (yield* readHiddenProjectIds(transaction)).has(reservation.projectId);
      // Re-adding a removed Project's own folder brings the same Project back (Q24).
      if (sameFolder && hidden) yield* showProject(transaction, reservation.projectId);
      return {
        proposal,
        existing: {
          status: relation(sameFolder, hidden),
          projectId: reservation.projectId,
          name: registeredName(registered.paths.worktree),
          hidden: hidden && !sameFolder,
        },
      } as const;
    }),
  );
}
