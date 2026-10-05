import { randomUUID } from "node:crypto";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { decodeStrict, ProjectIdSchema } from "@slopstop/protocol";
import { expect, it } from "vitest";
import {
  commitAndLinkWorktree,
  registerFolder,
  registrationSession,
  type Session,
} from "./registration-flow-fixture.js";

async function registeredProject(session: Session) {
  const { git, registered } = await registerFolder(session, session.directory);
  if (registered.status !== "registered") throw new Error("Registration missing");
  return { git, projectId: registered.projectId };
}

async function listedIds(session: Session) {
  const listed = await session.list();
  if (listed.status !== "listed") throw new Error(`List unavailable: ${JSON.stringify(listed)}`);
  return listed.projects.map((project) => project.projectId);
}

it.runIf(process.platform === "win32")(
  "hides a non-active Project from the list and brings the same Project back when re-added",
  async () => {
    const session = await registrationSession();
    try {
      const { git, projectId } = await registeredProject(session);
      const remove = { step: "remove-from-list", projectId } as const;
      expect(await session.register(remove)).toEqual({ status: "removed", projectId });
      expect(await listedIds(session)).toEqual([]);
      expect(await session.register(remove)).toEqual({ status: "removed", projectId });

      const again = await session.prepareFolder(session.directory, git);
      expect(again.result).toEqual({ status: "restored-to-list", projectId, name: "repository" });
      expect(await listedIds(session)).toEqual([projectId]);
    } finally {
      await session.dispose();
    }
  },
);

it.runIf(process.platform === "win32")(
  "refuses to remove an unknown, an incomplete or the active Project, changing nothing",
  async () => {
    const session = await registrationSession();
    try {
      const { projectId } = await registeredProject(session);
      const unknown = decodeStrict(ProjectIdSchema, randomUUID());
      expect(await session.register({ step: "remove-from-list", projectId: unknown })).toEqual({
        status: "rejected",
        code: "PROJECT_NOT_FOUND",
      });

      expect(await session.activate(projectId)).toMatchObject({ status: "active" });
      expect(await session.register({ step: "remove-from-list", projectId })).toEqual({
        status: "rejected",
        code: "PROJECT_ACTIVE",
      });
      expect(await listedIds(session)).toEqual([projectId]);
    } finally {
      await session.dispose();
    }
  },
);

it.runIf(process.platform === "win32")(
  "reports how many Projects are hidden from the list",
  async () => {
    const session = await registrationSession();
    try {
      const { git, projectId } = await registeredProject(session);
      expect(await session.list()).toMatchObject({ status: "listed", hiddenCount: 0 });
      await session.register({ step: "remove-from-list", projectId });
      expect(await session.list()).toEqual({ status: "listed", projects: [], hiddenCount: 1 });

      await session.prepareFolder(session.directory, git);
      expect(await session.list()).toMatchObject({ status: "listed", hiddenCount: 0 });
    } finally {
      await session.dispose();
    }
  },
);

it.runIf(process.platform === "win32")("keeps an interrupted registration visible", async () => {
  const session = await registrationSession();
  try {
    const { projectId } = await registeredProject(session);
    // Fixture for active Storage whose registration publication did not survive.
    const database = new DatabaseSync(path.join(session.root, "installation", "application.db"));
    try {
      database.exec("DELETE FROM registration_publications");
    } finally {
      database.close();
    }
    expect(await session.register({ step: "remove-from-list", projectId })).toEqual({
      status: "rejected",
      code: "REGISTRATION_INCOMPLETE",
    });
    expect(await listedIds(session)).toEqual([projectId]);
  } finally {
    await session.dispose();
  }
});

it.runIf(process.platform === "win32")(
  "says a linked worktree belongs to a hidden Project without bringing it back",
  async () => {
    const session = await registrationSession();
    try {
      const linked = path.join(session.root, "linked");
      commitAndLinkWorktree(session.directory, linked);
      const { git, projectId } = await registeredProject(session);
      await session.register({ step: "remove-from-list", projectId });

      expect((await session.prepareFolder(linked, git)).result).toEqual({
        status: "belongs-to-project",
        projectId,
        name: "repository",
        hiddenFromList: true,
      });
      expect(await listedIds(session)).toEqual([]);
    } finally {
      await session.dispose();
    }
  },
);
