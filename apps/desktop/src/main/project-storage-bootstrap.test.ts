import path from "node:path";
import { pathToFileURL } from "node:url";
import { expect, it } from "vitest";
import {
  createProjectStorageHarnessBootstrap,
  projectStorageMigrationResourcesRoot,
} from "./project-storage-bootstrap.js";

it("derives private Storage and development/package migration roots", () => {
  const developmentMigrations = projectStorageMigrationResourcesRoot({
    isPackaged: false,
    resourcesPath: "C:/installed/resources",
    mainBundleDirectory: "C:/repo/.vite/build",
  });
  const packagedMigrations = projectStorageMigrationResourcesRoot({
    isPackaged: true,
    resourcesPath: "C:/installed/resources",
    mainBundleDirectory: "C:/repo/.vite/build",
  });

  expect(developmentMigrations).toBe(path.join("C:/repo/.vite/build", "harness-migrations"));
  expect(packagedMigrations).toBe(path.join("C:/installed/resources", "harness-migrations"));
  expect(
    createProjectStorageHarnessBootstrap({
      userDataRoot: "C:/Users/example/AppData/SlopStop",
      migrationResourcesRoot: packagedMigrations,
    }),
  ).toEqual({
    kind: "harness.connect",
    applicationStorageRootUrl: pathToFileURL(
      path.join("C:/Users/example/AppData/SlopStop", "storage"),
    ).href,
    migrationResourcesRootUrl: pathToFileURL(packagedMigrations).href,
  });
});
