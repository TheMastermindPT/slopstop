import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { MessageChannel } from "node:worker_threads";
import {
  createHandshakeCommand,
  createProjectListCommand,
  createProjectRegistrationCommand,
  type ProjectRegistrationRequest,
  parseHarnessMessage,
} from "@slopstop/protocol";
import { afterEach } from "vitest";
import { startHarnessProcessRuntime } from "../../src/process-bootstrap.js";
import { checkedInMigrationRoot, transportFor } from "./project-storage-runtime-fixture.js";
import { installedGit } from "./registration-git-fixture.js";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

export const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Git consent ids reusable across folders while the executable identity holds (D8). */
export type GitConsent = Readonly<{
  selectionId: string;
  observationId: string;
  consentId: string;
}>;

/**
 * A harness process runtime over a fresh installation, driven through its transport with
 * one fresh Git repository at `directory`.
 */
export async function registrationSession() {
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
    if (!parsed.ok || parsed.value.messageType !== "event")
      throw new Error("Harness answered with an invalid message.");
    return parsed.value;
  };
  const metadata = () => ({
    messageId: `00000000-0000-4000-8000-${String(sequence++).padStart(12, "0")}`,
    sentAt: "2026-10-04T12:00:00.000Z",
  });
  const register = async (request: ProjectRegistrationRequest) => {
    const event = await exchange(createProjectRegistrationCommand(metadata(), request));
    if (event.event !== "project.registration.result")
      throw new Error(`Unexpected harness event ${JSON.stringify(event)}`);
    return event.payload;
  };
  const list = async () => {
    const event = await exchange(createProjectListCommand(metadata()));
    if (event.event !== "project.list.result")
      throw new Error(`Unexpected harness event ${JSON.stringify(event)}`);
    return event.payload;
  };
  const approveGit = async (): Promise<GitConsent> => {
    const git = await register({ step: "prepare-git" });
    if (git.status !== "git-prepared") throw new Error("Git preparation missing");
    const version = await register({
      step: "decide-git-version",
      selectionId: git.selectionId,
      consentId: randomUUID(),
      decision: "accepted",
    });
    if (version.status !== "git-version-observed") throw new Error("Git version missing");
    const consent = {
      selectionId: git.selectionId,
      observationId: version.observationId,
      consentId: randomUUID(),
    };
    const recorded = await register({
      step: "decide-identity-queries",
      ...consent,
      decision: "accepted",
    });
    if (recorded.status !== "identity-queries-recorded") throw new Error("Consent missing");
    return consent;
  };
  /** Selects and trusts one folder, then prepares its proposal with the given Git consent. */
  const prepareFolder = async (folder: string, git: GitConsent) => {
    const selected = await register({ step: "select-repository", directory: folder });
    if (selected.status !== "repository-selected") throw new Error("Selection missing");
    const trustId = randomUUID();
    const trusted = await register({
      step: "decide-trust",
      repositorySelectionId: selected.repositorySelectionId,
      trustId,
      decision: "accepted",
    });
    if (trusted.status !== "trust-recorded") throw new Error("Trust missing");
    const preparation = {
      preparationRequestId: randomUUID(),
      ...git,
      repositorySelectionId: selected.repositorySelectionId,
      trustId,
    };
    const result = await register({ step: "prepare", ...preparation });
    return { preparation, result };
  };
  await exchange(createHandshakeCommand(metadata(), "0.0.0"));
  return {
    root,
    directory,
    register,
    list,
    approveGit,
    prepareFolder,
    dispose: async () => {
      await stop();
      port1.close();
      port2.close();
    },
  };
}
