import type { ProjectStorageStoreDependencies } from "../storage/project-storage-store.js";
import type { IdentityQueryChildPort } from "./identity-query-child.js";
import { listRegisteredProjects } from "./project-listing.js";
import { createProjectRegistrationPreparation } from "./project-registration-preparation.js";
import { createRegistrationStorageBootstrap } from "./registration-storage-bootstrap.js";
import type { RegistrationDatabaseOptions } from "./registry-database.js";
import type { RepositoryTrustOwner } from "./repository-trust.js";

export function createProjectRegistrationOwner(
  registry: RepositoryTrustOwner,
  options: RegistrationDatabaseOptions & {
    applicationVersion: string;
    storageFailures?: ProjectStorageStoreDependencies["failures"];
  },
  controlDirectory: string,
  child?: IdentityQueryChildPort,
) {
  return createProjectRegistrationPreparation(
    registry,
    options,
    controlDirectory,
    child,
    createRegistrationStorageBootstrap(registry, options),
    (signal) => listRegisteredProjects(options, signal),
  );
}
