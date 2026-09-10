import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { inspectFilesystemWitnesses } from "./project-storage-filesystem-authority.js";
import { inspectUnregisteredOpening } from "./project-storage-opening.js";

it("classifies the canonical Writer lease only at the Project root", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "slopstop-writer-witness-"));
  const projectRoot = path.join(temporary, "project");
  const leasePath = path.join(projectRoot, ".slopstop-writer.lock");
  await mkdir(projectRoot);
  try {
    await writeFile(leasePath, "");
    const scan = await inspectFilesystemWitnesses({ projectRoot });
    expect(scan).toEqual({
      kinds: ["project-root", "writer-lease"],
      hasStagingGeneration: false,
      ordinaryGenerationIds: [],
      hasRootDatabaseWitness: false,
    });
    expect(
      inspectUnregisteredOpening({
        registrationCount: 0,
        generations: [],
        locationCount: 0,
        filesystemWitnessCount: scan.kinds.length,
      }),
    ).toEqual({
      status: "recovery-required",
      identity: {
        storageId: null,
        generationId: null,
        canonicalDatabaseLineageId: null,
        runtimeDatabaseLineageId: null,
      },
    });
    await rm(leasePath);
    await mkdir(leasePath);
    await expect(inspectFilesystemWitnesses({ projectRoot })).rejects.toThrow(
      "Project Storage file witness type is invalid.",
    );
    await rm(leasePath, { recursive: true });
    const target = path.join(temporary, "link-target");
    await mkdir(target);
    await symlink(target, leasePath, process.platform === "win32" ? "junction" : "dir");
    await expect(inspectFilesystemWitnesses({ projectRoot })).rejects.toThrow(
      "Project Storage witness must not be a symbolic link.",
    );
    await rm(leasePath);
    const generation = path.join(projectRoot, "00000000-0000-4000-8000-000000000014");
    await mkdir(generation);
    await writeFile(path.join(generation, ".slopstop-writer.lock"), "");
    await expect(inspectFilesystemWitnesses({ projectRoot })).rejects.toThrow(
      "Project Storage generation contains an unknown witness.",
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
