import { decodeStrict, ProjectStorageCreateRequestSchema } from "@slopstop/protocol";

/** A fixed Project Storage create request shared by node adapter cases. */
export const createRequest = decodeStrict(ProjectStorageCreateRequestSchema, {
  projectId: "00000000-0000-4000-8000-000000000010",
  createRequestId: "00000000-0000-4000-8000-000000000011",
});
