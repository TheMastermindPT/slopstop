import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { decodeStrict, RegisteredProjectSchema } from "@slopstop/protocol";
import { Schema } from "effect";
import { expect, it } from "vitest";
import { listRegisteredProjects } from "../../src/registration/project-listing.js";
import { checkedInMigrationRoot, createRequest } from "./project-storage-runtime-fixture.js";
import {
  activeGenerationDirectory,
  createGenerationThreeProject,
  rewindToGenerationThree,
} from "./project-storage-upgrade-fixture.js";

// Invoked only by the Electron E2E fixture, after the entry seed, never a fake renderer data source.
it.runIf(process.env["SLOPSTOP_CONVERSATION_JOURNEY_SEED"] !== undefined)(
  "seeds generation-three Projects for the Electron conversation journey",
  async () => {
    const userData = process.env["SLOPSTOP_CONVERSATION_JOURNEY_SEED"];
    if (userData === undefined) throw new Error("Missing disposable userData root");
    const storage = path.join(userData, "storage");
    const [repositoryA, repositoryB] = decodeStrict(
      Schema.Array(RegisteredProjectSchema),
      JSON.parse(await readFile(path.join(userData, "fixture-projects.json"), "utf8")),
    );
    if (repositoryA === undefined || repositoryB === undefined)
      throw new Error("Run the entry seed first");
    await rewindToGenerationThree({
      generationDirectory: activeGenerationDirectory(storage, repositoryB.projectId),
    });
    await createGenerationThreeProject(storage);
    const listed = await listRegisteredProjects(
      {
        applicationStorageRoot: storage,
        migrationResourcesRoot: checkedInMigrationRoot,
        applicationVersion: "0.0.0",
      },
      new AbortController().signal,
    );
    const rows = listed.status === "listed" ? listed.projects : [];
    const byId = (projectId: string) => rows.find((row) => row.projectId === projectId);
    expect(listed).toMatchObject({ status: "listed", hiddenCount: 0 });
    expect(rows).toHaveLength(3);
    expect(byId(repositoryA.projectId)).toMatchObject({
      registration: "registered",
      name: "repository-a",
      storage: { status: "healthy" },
    });
    expect(byId(repositoryB.projectId)).toMatchObject({
      registration: "registered",
      name: "repository-b",
      storage: { status: "safe-mode", canonical: "migration-required" },
    });
    expect(byId(createRequest.projectId)).toMatchObject({
      registration: "unbound",
      storage: { status: "safe-mode", canonical: "migration-required" },
    });
    await writeFile(
      path.join(userData, "fixture-journey-projects.json"),
      JSON.stringify({ storageOnlyProjectId: createRequest.projectId }),
    );
  },
);
