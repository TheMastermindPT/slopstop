import { randomUUID } from "node:crypto";
import path from "node:path";
import { expect, it } from "vitest";
import { registrationSession, uuid } from "./registration-flow-fixture.js";
import { installedGit } from "./registration-git-fixture.js";

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
