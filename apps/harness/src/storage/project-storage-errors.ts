export class ProjectStorageUnavailableError extends Error {
  override readonly name = "ProjectStorageUnavailableError";
}

export class ProjectStorageBrokenError extends Error {
  override readonly name = "ProjectStorageBrokenError";
}

/** The broken answer of an opening whose release failed, for plain openings and upgrades alike. */
export const openingReleaseFailedMessage = "Project Storage opening release failed.";

export class ProjectStorageApplicationClientInitializationError extends ProjectStorageBrokenError {}
