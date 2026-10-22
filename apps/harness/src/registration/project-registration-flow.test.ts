import { decodeStrict } from "@slopstop/protocol";
import { Deferred, Effect } from "effect";
import { expect, it } from "vitest";
import {
  createDirectoryHandoff,
  createProjectRegistrationFlow,
} from "./project-registration-flow.js";
import { RepositoryTrustRequestSchema } from "./repository-trust.js";

type FlowDependencies = Parameters<typeof createProjectRegistrationFlow>[0];

const selectionIds: Record<string, string> = {
  d1: "00000000-0000-4000-8000-0000000000d1",
  d2: "00000000-0000-4000-8000-0000000000d2",
  d3: "00000000-0000-4000-8000-0000000000d3",
};

/** The selection id this test derives from an offered directory. */
function selectionIdOf(directory: string) {
  return decodeStrict(RepositoryTrustRequestSchema, {
    repositorySelectionId: selectionIds[directory],
    trustId: "00000000-0000-4000-8000-0000000000aa",
  }).repositorySelectionId;
}

function unexpected(): Promise<never> {
  return Promise.reject(new Error("Unexpected registration call."));
}

it("handles a registration request that arrives after a completed one behind the queued request", async () => {
  const selection = createDirectoryHandoff();
  const directories: string[] = [];
  // Request 1 waits on the gate once it has recorded its directory.
  const entered = Deferred.makeUnsafe<void>();
  const gate = Deferred.makeUnsafe<void>();
  const registry: FlowDependencies["registry"] = {
    selectRepository: async () => {
      const selected = await selection.port.select();
      if (selected.status !== "selected") return Promise.reject(new Error("No directory offered."));
      directories.push(selected.directory);
      if (selected.directory === "d1") {
        Deferred.doneUnsafe(entered, Effect.void);
        await Effect.runPromise(Deferred.await(gate));
      }
      return { status: "prepared", repositorySelectionId: selectionIdOf(selected.directory) };
    },
    decideRepositoryTrust: unexpected,
    prepareExecutable: unexpected,
    decideVersion: unexpected,
    decideIdentityQueries: unexpected,
  };
  const flow = createProjectRegistrationFlow({
    registry,
    observer: {
      inspectGitVersion: unexpected,
      closeEffect: Effect.die("Unexpected observer close."),
      close: unexpected,
    },
    selection,
    discoverGit: () => Effect.die("Unexpected Git discovery."),
    createId: () => {
      throw new Error("Unexpected id.");
    },
    owner: { prepare: unexpected, confirm: unexpected },
    options: { applicationStorageRoot: "unused", migrationResourcesRoot: "unused" },
  });
  const handle = (directory: string) =>
    Effect.runPromise(flow.handle({ step: "select-repository", directory }));
  const first = handle("d1");
  const second = handle("d2");
  const third = first.then(() => handle("d3"));
  await Effect.runPromise(Deferred.await(entered));
  expect(directories).toEqual(["d1"]);
  Deferred.doneUnsafe(gate, Effect.void);
  const answers = [await first, await second, await third];
  expect(directories).toEqual(["d1", "d2", "d3"]);
  expect(answers).toEqual(
    ["d1", "d2", "d3"].map((directory) => ({
      status: "repository-selected",
      repositorySelectionId: selectionIdOf(directory),
    })),
  );
});
