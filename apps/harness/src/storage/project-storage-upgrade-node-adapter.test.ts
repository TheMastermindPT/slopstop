import os from "node:os";
import { decodeStrict, ProjectIdSchema } from "@slopstop/protocol";
import { expect, it } from "vitest";
import {
  ProjectStorageBrokenError,
  ProjectStorageUnavailableError,
} from "./project-storage-errors.js";
import { createProjectStorageFileAdapter } from "./project-storage-file-adapter.js";
import { ProjectStorageUpgradeBusyError } from "./project-storage-upgrade.js";
import { createProjectStorageUpgradeSteps } from "./project-storage-upgrade-node-adapter.js";

const unused = (): never => {
  throw new Error("Not used by the marker lookup.");
};

/** Upgrade steps whose registry client fails with `failure` before the marker query. */
function stepsFailingWith(failure: unknown) {
  return createProjectStorageUpgradeSteps({
    applicationClient: unused,
    existingApplicationClient: async () => {
      throw failure;
    },
    loadMigrations: unused,
    readMetadata: unused,
    paths: { forCreation: unused },
    files: createProjectStorageFileAdapter({ applicationStorageRoot: os.tmpdir() }),
    sha256File: unused,
    failures: { checkpoint: async () => undefined },
  });
}

const projectId = decodeStrict(ProjectIdSchema, "00000000-0000-4000-8000-000000000010");

it("passes a typed unavailable registry through the marker lookup unchanged", async () => {
  const unavailable = new ProjectStorageUnavailableError("Project Storage owner is stopped.");
  const steps = createProjectStorageUpgradeSteps({
    applicationClient: unused,
    existingApplicationClient: async () => {
      throw unavailable;
    },
    loadMigrations: unused,
    readMetadata: unused,
    paths: { forCreation: unused },
    files: createProjectStorageFileAdapter({ applicationStorageRoot: os.tmpdir() }),
    sha256File: unused,
    failures: { checkpoint: async () => undefined },
  });
  const projectId = decodeStrict(ProjectIdSchema, "00000000-0000-4000-8000-000000000010");
  await expect(steps.findUnfinished(projectId)).rejects.toBe(unavailable);
});

it.each([
  {
    name: "a raw busy error is busy",
    failure: Object.assign(new Error("database is locked"), { code: "SQLITE_BUSY" }),
    kind: ProjectStorageUpgradeBusyError,
  },
  {
    name: "anything else is broken",
    failure: new Error("disk I/O"),
    kind: ProjectStorageBrokenError,
  },
])("keeps the marker failure's cause: $name", async ({ failure, kind }) => {
  const outcome = await stepsFailingWith(failure)
    .findUnfinished(projectId)
    .catch((error: unknown) => error);
  expect(outcome).toBeInstanceOf(kind);
  expect(outcome).toHaveProperty("cause", failure);
});
