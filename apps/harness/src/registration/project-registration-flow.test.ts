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

/** A flow whose consent and preparation ports record their arguments and answer at once. */
function recordingFlow() {
  const calls: Record<string, unknown[]> = {
    decideVersion: [],
    decideIdentityQueries: [],
    prepare: [],
  };
  const record = (name: string) => async (input: unknown) => {
    calls[name]?.push(input);
    return { status: "recorded" } as const;
  };
  const flow = createProjectRegistrationFlow({
    registry: {
      selectRepository: unexpected,
      decideRepositoryTrust: unexpected,
      prepareExecutable: unexpected,
      decideVersion: record("decideVersion"),
      decideIdentityQueries: record("decideIdentityQueries"),
    },
    observer: {
      inspectGitVersion: unexpected,
      closeEffect: Effect.die("Unexpected observer close."),
      close: unexpected,
    },
    selection: createDirectoryHandoff(),
    discoverGit: () => Effect.die("Unexpected Git discovery."),
    createId: () => {
      throw new Error("Unexpected id.");
    },
    owner: {
      prepare: async (input: unknown) => {
        calls["prepare"]?.push(input);
        return { status: "rejected", code: "REPOSITORY_NOT_FOUND" };
      },
      confirm: unexpected,
    },
    options: { applicationStorageRoot: "unused", migrationResourcesRoot: "unused" },
  });
  return {
    calls,
    handle: (request: Parameters<typeof flow.handle>[0]) => Effect.runPromise(flow.handle(request)),
  };
}

it("routes each wire consent to its own consent", async () => {
  const id = (suffix: string) => `018f47a3-4e3d-7d2b-9c41-7df4605c0${suffix}`;
  const [c1, c2] = [id("c01"), id("c02")];
  const { calls, handle } = recordingFlow();
  const selectionId = id("a01");
  const observationId = id("a02");

  await expect(
    handle({
      step: "decide-git-version",
      selectionId,
      executableConsentId: c1,
      decision: "declined",
    }),
  ).resolves.toEqual({ status: "cancelled" });
  expect(calls["decideVersion"]).toEqual([{ selectionId, consentId: c1, decision: "declined" }]);

  await expect(
    handle({
      step: "decide-identity-queries",
      selectionId,
      observationId,
      identityQueryConsentId: c2,
      decision: "declined",
    }),
  ).resolves.toEqual({ status: "cancelled" });
  expect(calls["decideIdentityQueries"]).toEqual([
    { selectionId, observationId, consentId: c2, decision: "declined" },
  ]);

  await handle({
    step: "prepare",
    preparationRequestId: id("a03"),
    selectionId,
    observationId,
    identityQueryConsentId: c2,
    repositorySelectionId: id("a04"),
    trustId: id("a05"),
  });
  expect(calls["prepare"]).toEqual([
    expect.objectContaining({ admission: expect.objectContaining({ consentId: c2 }) }),
  ]);
});
