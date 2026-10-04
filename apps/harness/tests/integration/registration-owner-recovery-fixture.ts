import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decodeStrict, decodeStrictResult, UuidTextSchema } from "@slopstop/protocol";
import { Result, Schema } from "effect";
import {
  createProjectRegistrationObserver,
  type GitVersionInspectionRequest,
  GitVersionInspectionRequestSchema,
} from "../../src/project-registration-observer.js";
import { createGitVersionInspection } from "../../src/registration/git-version-inspection.js";
import type { RegistrationRegistry } from "../../src/registration/registration-registry.js";
import { createVersionObservationExecution } from "../../src/registration/version-observation-execution.js";
import { createWindowsVersionChild } from "../../src/registration/windows-version-child.js";
import { observeSelectedExecutable } from "../../src/storage/repository-identity-observer.js";
import { switchDeferred } from "./project-storage-runtime-fixture.js";
import { createRegistryVersionScenario } from "./registration-version-fixture.js";

export const ownerCheckpoints = [
  "intent",
  "before-child",
  "child-stored",
  "before-terminal",
  "terminal-stored",
  "outcome-stored",
] as const;
const checkpointSchema = Schema.Struct({
  kind: Schema.Literal("checkpoint"),
  point: Schema.Literals(ownerCheckpoints),
  observationId: UuidTextSchema,
  identity: Schema.optional(
    Schema.Struct({
      platform: Schema.Literal("win32"),
      processId: Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0)),
      creationTime100ns: Schema.String,
      jobName: Schema.String,
      sessionId: Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
    }),
  ),
});

export async function startObserverOwner(
  root: string,
  checkpoint: (typeof ownerCheckpoints)[number],
  request: GitVersionInspectionRequest,
) {
  const child = spawn(
    process.execPath,
    [
      "--experimental-transform-types",
      fileURLToPath(new URL("./registration-observer-peer.mjs", import.meta.url)),
      root,
      path.resolve(import.meta.dirname, "../../drizzle"),
      checkpoint,
      JSON.stringify(request),
    ],
    { stdio: ["ignore", "ignore", "pipe", "ipc"], windowsHide: true },
  );
  let diagnostic = "";
  child.stderr?.on("data", (data: Buffer) => {
    diagnostic += data.toString();
  });
  const exited = new Promise<void>((resolve) => child.once("close", () => resolve()));
  const messages: unknown[] = [];
  child.on("message", (message) => messages.push(message));
  const kill = async () => {
    // This ChildProcess was created by this fixture; never select an arbitrary PID/image.
    if (child.exitCode === null && child.signalCode === null) child.kill();
    await exited;
  };
  try {
    const reached = await new Promise<typeof checkpointSchema.Type>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Owner checkpoint timed out: ${diagnostic}`)),
        10000,
      );
      child.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once("exit", () => {
        clearTimeout(timer);
        reject(new Error(`Owner exited early: ${diagnostic}`));
      });
      child.once("message", (message) => {
        clearTimeout(timer);
        const parsed = decodeStrictResult(checkpointSchema, message);
        if (Result.isSuccess(parsed)) resolve(parsed.success);
        else reject(new Error(`Unexpected owner message: ${JSON.stringify(message)}`));
      });
    });
    return { reached, kill, messages };
  } catch (error) {
    await kill();
    throw error;
  }
}

export function recoveringObserver(root: string, registry: RegistrationRegistry) {
  let dispatches = 0;
  const native = createWindowsVersionChild(root);
  const observer = createProjectRegistrationObserver(
    createGitVersionInspection(
      registry,
      createVersionObservationExecution({
        inspectIdentity: observeSelectedExecutable,
        journal: registry,
        child: {
          run: (request, signal) => {
            dispatches += 1;
            return native.run(request, signal);
          },
        },
      }),
    ),
    registry,
  );
  return { observer, dispatches: () => dispatches };
}

export async function newVersionRequest(registry: RegistrationRegistry) {
  const request = decodeStrict(GitVersionInspectionRequestSchema, {
    selectionId: randomUUID(),
    consentId: randomUUID(),
  });
  if (request.consentId === null) throw new Error("Missing fixture consent");
  const selected = await registry.prepareExecutable({
    selectionId: request.selectionId,
    executablePath: path.join(process.env["ProgramFiles"] ?? "C:/Program Files", "Git/cmd/git.exe"),
  });
  if (selected.status !== "prepared") throw new Error(`Fixture selection: ${selected.status}`);
  const consent = await registry.decideVersion({
    ...request,
    consentId: request.consentId,
    decision: "accepted",
  });
  if (consent.status !== "recorded") throw new Error("Fixture consent failed");
  return request;
}

export async function heldHistoricalChild(root: string) {
  const release = switchDeferred<void>();
  const owned = switchDeferred<void>();
  const native = createWindowsVersionChild(root);
  const scenario = await createRegistryVersionScenario(root, {
    run: async (request, signal) => {
      await native.run(
        {
          ...request,
          onOwned: async (identity) => {
            await request.onOwned({
              ...identity,
              creationTime100ns: String(BigInt(identity.creationTime100ns) - 1n),
            });
            owned.resolve();
            await release.promise;
          },
        },
        signal,
      );
      throw new Error("Controlled loss of terminal publication");
    },
  });
  return { ...scenario, release, owned };
}
