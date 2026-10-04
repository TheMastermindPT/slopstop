import "./registration-peer-loader.mjs";

const { createRegistrationRegistry } = await import(
  "../../src/registration/registration-registry.ts"
);
const { GitVersionInspectionRequestSchema } = await import(
  "../../src/project-registration-observer.ts"
);
const { decodeStrict } = await import("@slopstop/protocol");
const [root, migrations, hold] = process.argv.slice(2);
let release;
const barrier = new Promise((resolve) => {
  release = resolve;
});
const registry = createRegistrationRegistry({
  applicationStorageRoot: root,
  migrationResourcesRoot: migrations,
  failures: {
    checkpoint: async (point) => {
      if (point !== "before-ddl") return;
      process.send({ kind: "migration" });
      if (hold === "hold") {
        process.send({ kind: "locked" });
        await barrier;
      }
    },
  },
});

process.on("message", (message) => {
  if (message?.kind === "release") {
    release();
    return;
  }
  if (message?.kind === "stop") {
    void registry.stop().then(
      () => process.exit(0),
      () => process.exit(1),
    );
    return;
  }
  if (message?.kind !== "prepare") {
    process.exitCode = 2;
    return;
  }
  const request = decodeStrict(GitVersionInspectionRequestSchema, {
    selectionId: message.selectionId,
    consentId: null,
  });
  void registry
    .prepareExecutable({ selectionId: request.selectionId, executablePath: message.executablePath })
    .then(
      (outcome) => process.send({ kind: "result", outcome }),
      (error) => {
        process.send({ kind: "failed", message: String(error) });
      },
    );
});
process.send({ kind: "ready" });
