import { Data } from "effect";

/** The message and cause a native `Error(message?, options?)` call would own. */
export type NativeErrorFields = Readonly<{ message?: string; cause?: unknown }>;

/** The fields of a native error call: the message only when given, the cause only when set. */
export function nativeErrorFields(message?: string, options?: ErrorOptions): NativeErrorFields {
  return {
    ...(message === undefined ? {} : { message }),
    ...(options !== undefined && "cause" in options ? { cause: options.cause } : {}),
  };
}

export class ProjectStorageUnavailableError extends Data.TaggedError(
  "ProjectStorageUnavailableError",
)<NativeErrorFields> {
  constructor(message?: string, options?: ErrorOptions) {
    super(nativeErrorFields(message, options));
  }
}

export class ProjectStorageBrokenError extends Data.TaggedError(
  "ProjectStorageBrokenError",
)<NativeErrorFields> {
  constructor(message?: string, options?: ErrorOptions) {
    super(nativeErrorFields(message, options));
  }
}

/** The broken answer of an opening whose release failed, for plain openings and upgrades alike. */
export class ProjectStorageOpeningReleaseFailedError extends ProjectStorageBrokenError {
  constructor(cause: unknown) {
    super("Project Storage opening release failed.", { cause });
  }
}

export class ProjectStorageApplicationClientInitializationError extends ProjectStorageBrokenError {}
