import { randomUUID } from "node:crypto";
import { lstatSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HarnessBootstrapSchema } from "@slopstop/protocol";
import {
  type HarnessTransport,
  type StopHarnessRuntime,
  startHarnessRuntime,
} from "./harness-runtime.js";
import { createProjectStorageApplication } from "./project-storage-application.js";
import { createNodeProjectStorageDependencies } from "./storage/project-storage-node-adapters.js";
import { createProjectStorageOwner } from "./storage/project-storage-store.js";
import { createUnavailableWorkspaceApplication } from "./workspace-application.js";

function isMissingPathError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function parentOf(root: string): string {
  const parent = path.dirname(root);
  if (parent === root) throw new Error("Harness bootstrap root has no existing ancestor.");
  return parent;
}

function physicalRoot(root: string): string {
  const missingSegments: string[] = [];
  let cursor = root;
  for (;;) {
    try {
      const entry = lstatSync(cursor);
      if (entry.isSymbolicLink()) {
        throw new Error("Harness bootstrap root must not be a symbolic link.");
      }
      return path.join(realpathSync.native(cursor), ...missingSegments.reverse());
    } catch (error: unknown) {
      if (!isMissingPathError(error)) throw error;
      missingSegments.push(path.basename(cursor));
      cursor = parentOf(cursor);
    }
  }
}

function trustedRoot(value: string): string {
  const root = path.resolve(fileURLToPath(value));
  if (!path.isAbsolute(root)) {
    throw new Error("Harness bootstrap root must resolve absolutely.");
  }
  return physicalRoot(root);
}

function rootsOverlap(first: string, second: string): boolean {
  const relative = path.relative(first, second);
  return (
    relative === "" ||
    (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  );
}

export function startHarnessProcessRuntime(
  input: Readonly<{
    bootstrap: unknown;
    transport: HarnessTransport;
  }>,
): StopHarnessRuntime {
  const bootstrap = HarnessBootstrapSchema.parse(input.bootstrap);
  const applicationStorageRoot = trustedRoot(bootstrap.applicationStorageRootUrl);
  const migrationResourcesRoot = trustedRoot(bootstrap.migrationResourcesRootUrl);
  if (
    rootsOverlap(applicationStorageRoot, migrationResourcesRoot) ||
    rootsOverlap(migrationResourcesRoot, applicationStorageRoot)
  ) {
    throw new Error("Harness bootstrap roots must not overlap.");
  }
  const projectStorageOwner = createProjectStorageOwner(
    createNodeProjectStorageDependencies({
      applicationStorageRoot,
      migrationResourcesRoot,
      applicationVersion: "0.0.0",
    }),
  );

  return startHarnessRuntime({
    transport: input.transport,
    workspaceApplication: createUnavailableWorkspaceApplication(),
    projectStorageApplication: createProjectStorageApplication(projectStorageOwner),
    harnessVersion: "0.0.0",
    createId: randomUUID,
    now: () => new Date().toISOString(),
  });
}
