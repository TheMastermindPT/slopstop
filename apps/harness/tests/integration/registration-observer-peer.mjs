import "./registration-peer-loader.mjs";

const { createProjectRegistrationObserver, GitVersionInspectionRequestSchema } = await import(
  "../../src/project-registration-observer.ts"
);
const { decodeStrict } = await import("@slopstop/protocol");
const { createRegistrationRegistry } = await import(
  "../../src/registration/registration-registry.ts"
);
const { createGitVersionInspection } = await import(
  "../../src/registration/git-version-inspection.ts"
);
const { createVersionObservationExecution } = await import(
  "../../src/registration/version-observation-execution.ts"
);
const { createWindowsVersionChild } = await import(
  "../../src/registration/windows-version-child.ts"
);
const { observeSelectedExecutable } = await import(
  "../../src/storage/repository-identity-observer.ts"
);
const [root, migrations, checkpoint, requestJson] = process.argv.slice(2);
const request = decodeStrict(GitVersionInspectionRequestSchema, JSON.parse(requestJson));
const registry = createRegistrationRegistry({
  applicationStorageRoot: root,
  migrationResourcesRoot: migrations,
});
// Keep the owner alive at the selected durable/public boundary until its parent kills it.
process.on("message", () => undefined);
async function pause(point, observationId, identity) {
  if (point !== checkpoint) return;
  process.send({ kind: "checkpoint", point, observationId, identity });
  await new Promise(() => undefined);
}
const journal = {
  ...registry,
  begin: async (dispatch) => {
    const result = await registry.begin(dispatch);
    if (result.status === "started") await pause("intent", result.observationId);
    return result;
  },
  recordChild: async (id, identity) => {
    await pause("before-child", id, identity);
    await registry.recordChild(id, identity);
    await pause("child-stored", id, identity);
  },
  recordTerminal: async (id, terminal) => {
    await pause("before-terminal", id);
    await registry.recordTerminal(id, terminal);
    await pause("terminal-stored", id);
  },
  complete: async (result) => {
    await registry.complete(result);
    await pause("outcome-stored", result.observationId);
  },
};
const observer = createProjectRegistrationObserver(
  createGitVersionInspection(
    registry,
    createVersionObservationExecution({
      journal,
      child: createWindowsVersionChild(root),
      inspectIdentity: observeSelectedExecutable,
    }),
  ),
  registry,
);
try {
  const result = await observer.inspectGitVersion(request);
  process.send({ kind: "unexpected-result", result });
} catch (error) {
  process.send({ kind: "failed", message: String(error) });
}
