import os from "node:os";
import { decodeStrict, ProjectIdSchema } from "@slopstop/protocol";
import { expect, it } from "vitest";
import { ProjectStorageUnavailableError } from "./project-storage-errors.js";
import { createProjectStorageFileAdapter } from "./project-storage-file-adapter.js";
import { createProjectStorageUpgradeSteps } from "./project-storage-upgrade-node-adapter.js";

const unused = (): never => {
  throw new Error("Not used by the marker lookup.");
};

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
