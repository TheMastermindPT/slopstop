export class ProjectStorageUnavailableError extends Error {
  override readonly name = "ProjectStorageUnavailableError";
}

export class ProjectStorageBrokenError extends Error {
  override readonly name = "ProjectStorageBrokenError";
}

export class ProjectStorageApplicationClientInitializationError extends ProjectStorageBrokenError {}
