import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, it } from "vitest";
import { listRegisteredProjects } from "../../src/registration/project-listing.js";
import { checkedInMigrationRoot, createRequest } from "./project-storage-runtime-fixture.js";
import { createGenerationTwoProject } from "./project-storage-upgrade-fixture.js";

// Invoked only by the Electron E2E fixture, never a fake renderer data source.
it.runIf(process.env["PC_UPGRADE_USER_DATA"] !== undefined)(
  "seeds an older Project for the Electron update journey",
  async () => {
    const userData = process.env["PC_UPGRADE_USER_DATA"];
    if (userData === undefined) throw new Error("Missing disposable userData root");
    const storage = path.join(userData, "storage");
    await mkdir(storage, { recursive: true });
    await createGenerationTwoProject(storage);
    const listed = await listRegisteredProjects(
      {
        applicationStorageRoot: storage,
        migrationResourcesRoot: checkedInMigrationRoot,
        applicationVersion: "0.0.0",
      },
      new AbortController().signal,
    );
    expect(listed).toMatchObject({
      status: "listed",
      projects: [
        {
          registration: "unbound",
          projectId: createRequest.projectId,
          storage: { status: "safe-mode", canonical: "migration-required" },
        },
      ],
    });
    expect(listed.status === "listed" && listed.projects).toHaveLength(1);
    await writeFile(
      path.join(userData, "fixture-upgrade-project.json"),
      JSON.stringify({ projectId: createRequest.projectId }),
    );
  },
);
