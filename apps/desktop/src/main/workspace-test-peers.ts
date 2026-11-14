import {
  decodeStrict,
  MessageIdSchema,
  type WorkspaceIntent,
  WorkspaceIntentSchema,
  type WorkspaceQuery,
  WorkspaceQueryResultSchema,
  WorkspaceQuerySchema,
} from "@slopstop/protocol";

/** A UUID id; `value` makes it stable across a test. */
export function id(value: number): string {
  return decodeStrict(
    MessageIdSchema,
    `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`,
  );
}

/** A memory-library query for one Project. */
export function memoryQuery(project = 10): WorkspaceQuery {
  return decodeStrict(WorkspaceQuerySchema, {
    query: "memory-library.read",
    projectId: id(project),
    cursor: null,
  });
}

/** A memory proposal review intent. */
export function memoryIntent(): WorkspaceIntent {
  return decodeStrict(WorkspaceIntentSchema, {
    intent: "memory.proposal.review",
    projectId: id(10),
    proposalId: id(30),
    decision: "accept",
    expectedProjectionRevision: 0,
  });
}

/** The memory producer's unavailable answer to a query. */
export function unavailableQueryResult(query: WorkspaceQuery) {
  return decodeStrict(WorkspaceQueryResultSchema, {
    status: "unavailable",
    query,
    diagnostic: {
      code: "WORKSPACE_CAPABILITY_UNAVAILABLE",
      message: "Memory producer is unavailable.",
    },
  });
}
