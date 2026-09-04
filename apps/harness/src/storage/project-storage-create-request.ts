import type { ProjectStorageCreateRequest } from "@slopstop/protocol";

export function projectStorageCreateRequestFingerprintInput(
  request: ProjectStorageCreateRequest,
): string {
  return JSON.stringify({
    version: 1,
    projectId: request.projectId,
    createRequestId: request.createRequestId,
  });
}
