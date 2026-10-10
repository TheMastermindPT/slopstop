import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { MessageChannel } from "node:worker_threads";
import {
  CanonicalProjectActivationRequestSchema,
  createHandshakeCommand,
  createProjectActivateCommand,
  createProjectListCommand,
  createProjectRegistrationCommand,
  createProjectUpgradeCommand,
  decodeStrict,
  type HarnessMessage,
  type ProjectRegistrationRequest,
  ProjectUpgradeRequestSchema,
  parseHarnessMessage,
} from "@slopstop/protocol";
import { afterEach } from "vitest";
import { startHarnessProcessRuntime } from "../../src/process-bootstrap.js";
import {
  checkedInMigrationRoot,
  silentHarnessLogger,
  transportFor,
} from "./project-storage-runtime-fixture.js";
import { installedGit } from "./registration-git-fixture.js";

/** Each harness event name with the payload it carries. */
type PayloadByEvent = {
  [Event in HarnessMessage as Event["event"]]: Event extends { payload: infer Payload }
    ? Payload
    : never;
};

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
 * one fresh Git repository at `directory`. Given the `root` of an earlier session, it starts a
 * new runtime over that installation and repository instead.
 */
export async function registrationSession(existing?: Readonly<{ root: string }>) {
  const root = existing?.root ?? (await mkdtemp(path.join(tmpdir(), "opencode/pc-s1-flow-")));
  const directory = path.join(root, "repository");
  if (existing === undefined) {
    roots.push(root);
    execFileSync(installedGit, ["init", "--quiet", directory]);
  }
  const { port1, port2 } = new MessageChannel();
  const stop = startHarnessProcessRuntime({
    logger: silentHarnessLogger,
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
  /** Sends one command and answers the payload of the one event it must produce. */
  const answer = async <Name extends keyof PayloadByEvent>(
    command: unknown,
    name: Name,
  ): Promise<PayloadByEvent[Name]> => {
    const event = await exchange(command);
    if (event.event !== name) throw new Error(`Unexpected harness event ${JSON.stringify(event)}`);
    // The event name was just checked, so this event carries the payload of `name`.
    return Reflect.get(event, "payload") as PayloadByEvent[Name];
  };
  const register = (request: ProjectRegistrationRequest) =>
    answer(createProjectRegistrationCommand(metadata(), request), "project.registration.result");
  const list = () => answer(createProjectListCommand(metadata()), "project.list.result");
  const activate = (projectId: string) =>
    answer(
      createProjectActivateCommand(
        metadata(),
        decodeStrict(CanonicalProjectActivationRequestSchema, { projectId }),
      ),
      "project.activate.result",
    );
  const upgrade = (projectId: string) =>
    answer(
      createProjectUpgradeCommand(
        metadata(),
        decodeStrict(ProjectUpgradeRequestSchema, { projectId }),
      ),
      "project.upgrade.result",
    );
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
    activate,
    upgrade,
    approveGit,
    prepareFolder,
    dispose: async () => {
      await stop();
      port1.close();
      port2.close();
    },
  };
}

export type Session = Awaited<ReturnType<typeof registrationSession>>;

/** Approves Git, prepares the folder and confirms its proposal. */
export async function registerFolder(session: Session, folder: string) {
  const git = await session.approveGit();
  const { preparation, result } = await session.prepareFolder(folder, git);
  if (result.status !== "proposal-prepared") throw new Error("Proposal missing");
  const confirmation = {
    step: "confirm",
    requestId: randomUUID(),
    ...preparation,
    proposalId: result.proposalId,
    proposalFingerprint: result.proposalFingerprint,
  } as const;
  const registered = await session.register(confirmation);
  return { git, proposal: result, confirmation, registered };
}

/** Commits once in the repository and adds a linked worktree at `linked`. */
export function commitAndLinkWorktree(directory: string, linked: string) {
  const git = (...args: string[]) =>
    execFileSync(installedGit, [
      "-C",
      directory,
      "-c",
      "user.name=t",
      "-c",
      "user.email=t@t",
      ...args,
    ]);
  git("commit", "--quiet", "--allow-empty", "-m", "initial");
  git("worktree", "add", "--quiet", linked);
}
