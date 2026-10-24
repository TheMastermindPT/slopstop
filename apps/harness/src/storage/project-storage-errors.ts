export class ProjectStorageUnavailableError extends Error {
  override readonly name = "ProjectStorageUnavailableError";
}

export class ProjectStorageBrokenError extends Error {
  override readonly name = "ProjectStorageBrokenError";
}

/** The broken answer of an opening whose release failed, for plain openings and upgrades alike. */
export class ProjectStorageOpeningReleaseFailedError extends ProjectStorageBrokenError {
  constructor(cause: unknown) {
    super("Project Storage opening release failed.", { cause });
  }
}

export class ProjectStorageApplicationClientInitializationError extends ProjectStorageBrokenError {}
