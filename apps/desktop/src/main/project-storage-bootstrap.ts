import path from "node:path";
import { pathToFileURL } from "node:url";
import { decodeStrict, type HarnessBootstrap, HarnessBootstrapSchema } from "@slopstop/protocol";

export function projectStorageMigrationResourcesRoot(
  input: Readonly<{
    isPackaged: boolean;
    resourcesPath: string;
    mainBundleDirectory: string;
  }>,
): string {
  return input.isPackaged
    ? path.join(input.resourcesPath, "harness-migrations")
    : path.join(input.mainBundleDirectory, "harness-migrations");
}

export function createProjectStorageHarnessBootstrap(
  input: Readonly<{
    userDataRoot: string;
    migrationResourcesRoot: string;
  }>,
): HarnessBootstrap {
  return decodeStrict(HarnessBootstrapSchema, {
    kind: "harness.connect",
    applicationStorageRootUrl: pathToFileURL(path.join(input.userDataRoot, "storage")).href,
    migrationResourcesRootUrl: pathToFileURL(input.migrationResourcesRoot).href,
  });
}
