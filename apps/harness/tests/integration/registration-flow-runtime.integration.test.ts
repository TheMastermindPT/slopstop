import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { MessageChannel } from "node:worker_threads";
import {
  createHandshakeCommand,
  createProjectRegistrationCommand,
  type ProjectRegistrationRequest,
  parseHarnessMessage,
} from "@slopstop/protocol";
import { afterEach, expect, it } from "vitest";
import { startHarnessProcessRuntime } from "../../src/process-bootstrap.js";
import { checkedInMigrationRoot, transportFor } from "./project-storage-runtime-fixture.js";
import { installedGit } from "./registration-git-fixture.js";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

async function registrationSession() {
  const root = await mkdtemp(path.join(tmpdir(), "opencode/pc-s1-flow-"));
  roots.push(root);
  const directory = path.join(root, "repository");
  execFileSync(installedGit, ["init", "--quiet", directory]);
  const { port1, port2 } = new MessageChannel();
  const stop = startHarnessProcessRuntime({
    bootstrap: {
      kind: "harness.connect",
      applicationStorageRootUrl: pathToFileURL(path.join(root, "installation")).href,
      migrationResourcesRootUrl: pathToFileURL(checkedInMigrationRoot).href,
    },
    transport: transportFor(port1),
  });
  let sequence = 100;
  const exchange = async (command: unknown) => {
    const response = new Promise<unknown>((resolve) => port2.once("message", resolve));
    port2.postMessage(command);
    const parsed = parseHarnessMessage(await response);
    if (!parsed.ok) throw new Error("Harness answered with an invalid message.");
    return parsed.value;
  };
  const metadata = () => ({
    messageId: `00000000-0000-4000-8000-${String(sequence++).padStart(12, "0")}`,
    sentAt: "2026-10-04T12:00:00.000Z",
  });
  const register = async (request: ProjectRegistrationRequest) => {
    const event = await exchange(createProjectRegistrationCommand(metadata(), request));
    if (event.messageType !== "event" || event.event !== "project.registration.result")
      throw new Error(`Unexpected harness event ${JSON.stringify(event)}`);
    return event.payload;
  };
  await exchange(createHandshakeCommand(metadata(), "0.0.0"));
  return {
    root,
    directory,
    register,
    dispose: async () => {
      await stop();
      port1.close();
      port2.close();
    },
  };
}

it.runIf(process.platform === "win32")(
  "drives folder trust and both Git consent stages across the harness boundary",
  async () => {
    const session = await registrationSession();
    try {
      const selected = await session.register({
        step: "select-repository",
        directory: session.directory,
      });
      expect(selected).toEqual({
        status: "repository-selected",
        repositorySelectionId: expect.stringMatching(uuid),
      });
      if (selected.status !== "repository-selected") throw new Error("Selection missing");
      expect(
        await session.register({
          step: "decide-trust",
          repositorySelectionId: selected.repositorySelectionId,
          trustId: randomUUID(),
          decision: "accepted",
        }),
      ).toEqual({ status: "trust-recorded" });
      const git = await session.register({ step: "prepare-git" });
      expect(git).toEqual({
        status: "git-prepared",
        selectionId: expect.stringMatching(uuid),
        executablePath: installedGit,
      });
      if (git.status !== "git-prepared") throw new Error("Git preparation missing");
      const version = await session.register({
        step: "decide-git-version",
        selectionId: git.selectionId,
        consentId: randomUUID(),
        decision: "accepted",
      });
      expect(version).toEqual({
        status: "git-version-observed",
        selectionId: git.selectionId,
        observationId: expect.stringMatching(uuid),
        version: expect.stringMatching(/^\d+\.\d+\.\d+/),
      });
      if (version.status !== "git-version-observed") throw new Error("Git version missing");
      expect(
        await session.register({
          step: "decide-identity-queries",
          selectionId: git.selectionId,
          observationId: version.observationId,
          consentId: randomUUID(),
          decision: "accepted",
        }),
      ).toEqual({ status: "identity-queries-recorded" });
    } finally {
      await session.dispose();
    }
  },
);

it.runIf(process.platform === "win32")(
  "ends declined consent as cancelled and refuses a missing folder without selecting it",
  async () => {
    const session = await registrationSession();
    try {
      expect(
        await session.register({
          step: "select-repository",
          directory: path.join(session.root, "missing"),
        }),
      ).toEqual({ status: "rejected", code: "REPOSITORY_NOT_FOUND" });
      const git = await session.register({ step: "prepare-git" });
      if (git.status !== "git-prepared") throw new Error("Git preparation missing");
      expect(
        await session.register({
          step: "decide-git-version",
          selectionId: git.selectionId,
          consentId: randomUUID(),
          decision: "declined",
        }),
      ).toEqual({ status: "cancelled" });
      expect(
        await session.register({
          step: "decide-trust",
          repositorySelectionId: randomUUID(),
          trustId: randomUUID(),
          decision: "accepted",
        }),
      ).toEqual({ status: "unavailable", code: "REPOSITORY_TRUST_REQUIRED" });
    } finally {
      await session.dispose();
    }
  },
);
