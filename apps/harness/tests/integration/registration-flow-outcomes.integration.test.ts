import { mkdir } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, it } from "vitest";
import {
  commitAndLinkWorktree,
  registerFolder,
  registrationSession,
  uuid,
} from "./registration-flow-fixture.js";

const fingerprint = /^[0-9a-f]{64}$/;

it.runIf(process.platform === "win32")(
  "proposes, registers and lists a Project named after its worktree, then returns it again",
  async () => {
    const session = await registrationSession();
    try {
      const { git, proposal, registered } = await registerFolder(session, session.directory);
      expect(proposal).toEqual({
        status: "proposal-prepared",
        proposalId: expect.stringMatching(uuid),
        proposalFingerprint: expect.stringMatching(fingerprint),
        name: "repository",
        repositoryDirectory: session.directory,
        worktree: expect.any(String),
        gitVersion: expect.stringMatching(/^\d+\.\d+\.\d+/),
      });
      expect(registered).toEqual({
        status: "registered",
        projectId: expect.stringMatching(uuid),
        name: "repository",
      });
      if (registered.status !== "registered") throw new Error("Registration missing");

      const again = await session.prepareFolder(session.directory, git);
      expect(again.result).toEqual({
        status: "already-registered",
        projectId: registered.projectId,
        name: "repository",
      });
      expect(await session.list()).toEqual({
        status: "listed",
        projects: [
          expect.objectContaining({
            registration: "registered",
            projectId: registered.projectId,
            name: "repository",
          }),
        ],
      });
    } finally {
      await session.dispose();
    }
  },
);

it.runIf(process.platform === "win32")(
  "reports a linked worktree as belonging to its Project without creating another",
  async () => {
    const session = await registrationSession();
    try {
      const linked = path.join(session.root, "linked");
      commitAndLinkWorktree(session.directory, linked);
      const { git, registered } = await registerFolder(session, session.directory);
      if (registered.status !== "registered") throw new Error("Registration missing");

      const worktree = await session.prepareFolder(linked, git);
      expect(worktree.result).toEqual({
        status: "belongs-to-project",
        projectId: registered.projectId,
        name: "repository",
      });
      const listed = await session.list();
      if (listed.status !== "listed") throw new Error("List missing");
      expect(listed.projects).toHaveLength(1);
    } finally {
      await session.dispose();
    }
  },
);

it.runIf(process.platform === "win32")(
  "shows an interrupted registration as incomplete instead of proposing it again",
  async () => {
    const session = await registrationSession();
    try {
      const { git, registered } = await registerFolder(session, session.directory);
      if (registered.status !== "registered") throw new Error("Registration missing");
      // Fixture for active Storage whose registration publication did not survive.
      const database = new DatabaseSync(path.join(session.root, "installation", "application.db"));
      try {
        database.exec("DELETE FROM registration_publications");
      } finally {
        database.close();
      }

      expect((await session.prepareFolder(session.directory, git)).result).toEqual({
        status: "pending-recovery",
        code: "REGISTRATION_INCOMPLETE",
      });
      expect(await session.list()).toMatchObject({
        projects: [
          { registration: "incomplete", projectId: registered.projectId, name: "repository" },
        ],
      });
    } finally {
      await session.dispose();
    }
  },
);

it.runIf(process.platform === "win32")(
  "refuses a Git directory as no working tree and a plain folder as unreadable by Git, creating nothing",
  async () => {
    const session = await registrationSession();
    try {
      const plain = path.join(session.root, "plain");
      await mkdir(plain);
      const git = await session.approveGit();

      expect(
        (await session.prepareFolder(path.join(session.directory, ".git"), git)).result,
      ).toEqual({
        status: "rejected",
        code: "NOT_WORKING_TREE",
      });
      expect((await session.prepareFolder(plain, git)).result).toEqual({
        status: "unavailable",
        code: "GIT_QUERY_FAILED",
        exitCode: 128,
      });
      expect(await session.list()).toEqual({ status: "listed", projects: [] });
    } finally {
      await session.dispose();
    }
  },
);
