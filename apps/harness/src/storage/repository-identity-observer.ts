import type { ExecutableIdentityObservation } from "../registration/executable-identity.js";
import type { RepositoryDirectoryObservation } from "../registration/physical-identity.js";
import {
  observeWindowsDirectory,
  observeWindowsExecutable,
} from "../registration/windows-file-identity.js";

export async function observeRepositoryDirectory(
  location: string,
): Promise<RepositoryDirectoryObservation> {
  if (process.platform !== "win32" || process.arch !== "x64") {
    return { status: "unavailable", code: "IDENTITY_CAPABILITY_UNAVAILABLE" };
  }
  return observeWindowsDirectory(location);
}

export async function observeSelectedExecutable(
  location: string,
): Promise<ExecutableIdentityObservation> {
  if (process.platform !== "win32" || process.arch !== "x64") {
    return { status: "unavailable", code: "IDENTITY_CAPABILITY_UNAVAILABLE" };
  }
  return observeWindowsExecutable(location);
}
