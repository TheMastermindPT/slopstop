import type {
  WorkspaceCapability,
  WorkspaceIntent,
  WorkspaceIntentResult,
  WorkspaceNotification,
  WorkspaceQuery,
  WorkspaceQueryResult,
} from "@slopstop/protocol";
import { WorkspaceIntentResultSchema, WorkspaceQueryResultSchema } from "@slopstop/protocol";

type ConversationQuery = Extract<
  WorkspaceQuery,
  { query: "conversation.read" | "context-record.read" }
>;
type FrameQuery = Extract<WorkspaceQuery, { query: "frame-review.read" }>;
type MemoryQuery = Extract<WorkspaceQuery, { query: "memory-library.read" }>;

type ConversationIntent = Extract<
  WorkspaceIntent,
  { intent: "conversation.message.submit" | "conversation.influence.select" }
>;
type FrameIntent = Extract<
  WorkspaceIntent,
  { intent: "frame-review.annotate" | "frame.decision.accept" | "frame.accept" }
>;
type MemoryIntent = Extract<WorkspaceIntent, { intent: "memory.proposal.review" }>;

export type WorkspacePortQueryOutcome =
  | Readonly<{ status: "ready"; projection: unknown }>
  | Readonly<{ status: "unavailable"; message: string }>
  | Readonly<{ status: "broken"; message: string }>;

export type WorkspacePortIntentOutcome =
  | Readonly<{ status: "forwarded" }>
  | Readonly<{ status: "unavailable"; message: string }>
  | Readonly<{ status: "broken"; message: string }>;

export type WorkspaceOwnerNotification<C extends WorkspaceCapability> = Readonly<
  Omit<WorkspaceNotification, "capability"> & { capability: C }
>;

export interface WorkspaceOwnerPort<
  C extends WorkspaceCapability,
  Q extends WorkspaceQuery,
  I extends WorkspaceIntent,
> {
  query(query: Q): Promise<WorkspacePortQueryOutcome>;
  submit(intent: I): Promise<WorkspacePortIntentOutcome>;
  subscribe(listener: (notification: WorkspaceOwnerNotification<C>) => void): () => void;
}

export type ConversationWorkspacePort = WorkspaceOwnerPort<
  "conversation",
  ConversationQuery,
  ConversationIntent
>;
export type FrameWorkspacePort = WorkspaceOwnerPort<"frame", FrameQuery, FrameIntent>;
export type MemoryWorkspacePort = WorkspaceOwnerPort<"memory", MemoryQuery, MemoryIntent>;

export interface WorkspaceApplication {
  query(query: WorkspaceQuery): Promise<WorkspaceQueryResult>;
  submit(intent: WorkspaceIntent): Promise<WorkspaceIntentResult>;
  subscribe(listener: (notification: WorkspaceNotification) => void): () => void;
}

const capabilityLabels: Readonly<Record<WorkspaceCapability, string>> = {
  conversation: "Conversation",
  frame: "Frame",
  memory: "Memory",
};

type WorkspaceApplicationOptions = Readonly<{
  conversation: ConversationWorkspacePort;
  frame: FrameWorkspacePort;
  memory: MemoryWorkspacePort;
}>;

function readyQueryResult(query: WorkspaceQuery, projection: unknown): WorkspaceQueryResult | null {
  const parsed = WorkspaceQueryResultSchema.safeParse({
    status: "ready",
    query,
    projection,
  });
  return parsed.success ? parsed.data : null;
}

function unavailableQueryResult(
  query: WorkspaceQuery,
  capability: WorkspaceCapability,
  message: string,
): WorkspaceQueryResult {
  return WorkspaceQueryResultSchema.parse({
    status: "unavailable",
    query,
    diagnostic: {
      code: "WORKSPACE_CAPABILITY_UNAVAILABLE",
      message: message || `${capabilityLabels[capability]} producer is unavailable.`,
    },
  });
}

function brokenQueryResult(
  query: WorkspaceQuery,
  capability: WorkspaceCapability,
  code: "WORKSPACE_PRODUCER_FAILED" | "WORKSPACE_PROJECTION_INVALID",
  message: string,
): WorkspaceQueryResult {
  return WorkspaceQueryResultSchema.parse({
    status: "broken",
    query,
    diagnostic: {
      code,
      message: message || `${capabilityLabels[capability]} producer failed.`,
    },
  });
}

async function queryOwner<Q extends WorkspaceQuery>(
  capability: WorkspaceCapability,
  port: Pick<WorkspaceOwnerPort<WorkspaceCapability, Q, WorkspaceIntent>, "query">,
  query: Q,
): Promise<WorkspaceQueryResult> {
  try {
    const outcome = await port.query(query);
    switch (outcome.status) {
      case "ready":
        return (
          readyQueryResult(query, outcome.projection) ??
          brokenQueryResult(
            query,
            capability,
            "WORKSPACE_PROJECTION_INVALID",
            `${capabilityLabels[capability]} producer returned an invalid projection.`,
          )
        );
      case "unavailable":
        return unavailableQueryResult(query, capability, outcome.message);
      case "broken":
        return brokenQueryResult(query, capability, "WORKSPACE_PRODUCER_FAILED", outcome.message);
    }
  } catch {
    return brokenQueryResult(
      query,
      capability,
      "WORKSPACE_PRODUCER_FAILED",
      `${capabilityLabels[capability]} producer failed.`,
    );
  }
}

function intentResult(
  capability: WorkspaceCapability,
  outcome: WorkspacePortIntentOutcome,
): WorkspaceIntentResult {
  switch (outcome.status) {
    case "forwarded":
      return WorkspaceIntentResultSchema.parse({ status: "forwarded", capability });
    case "unavailable":
      return WorkspaceIntentResultSchema.parse({
        status: "unavailable",
        capability,
        diagnostic: {
          code: "WORKSPACE_CAPABILITY_UNAVAILABLE",
          message: outcome.message || `${capabilityLabels[capability]} producer is unavailable.`,
        },
      });
    case "broken":
      return WorkspaceIntentResultSchema.parse({
        status: "broken",
        capability,
        diagnostic: {
          code: "WORKSPACE_PRODUCER_FAILED",
          message: outcome.message || `${capabilityLabels[capability]} producer failed.`,
        },
      });
  }
}

async function submitOwner<I extends WorkspaceIntent>(
  capability: WorkspaceCapability,
  port: Pick<WorkspaceOwnerPort<WorkspaceCapability, WorkspaceQuery, I>, "submit">,
  intent: I,
): Promise<WorkspaceIntentResult> {
  try {
    return intentResult(capability, await port.submit(intent));
  } catch {
    return intentResult(capability, {
      status: "broken",
      message: `${capabilityLabels[capability]} producer failed.`,
    });
  }
}

export function createWorkspaceApplication(
  options: WorkspaceApplicationOptions,
): WorkspaceApplication {
  return {
    query: (query) => {
      switch (query.query) {
        case "conversation.read":
        case "context-record.read":
          return queryOwner("conversation", options.conversation, query);
        case "frame-review.read":
          return queryOwner("frame", options.frame, query);
        case "memory-library.read":
          return queryOwner("memory", options.memory, query);
      }
    },
    submit: (intent) => {
      switch (intent.intent) {
        case "conversation.message.submit":
        case "conversation.influence.select":
          return submitOwner("conversation", options.conversation, intent);
        case "frame-review.annotate":
        case "frame.decision.accept":
        case "frame.accept":
          return submitOwner("frame", options.frame, intent);
        case "memory.proposal.review":
          return submitOwner("memory", options.memory, intent);
      }
    },
    subscribe: (listener) => {
      const stops = [
        options.conversation.subscribe(listener),
        options.frame.subscribe(listener),
        options.memory.subscribe(listener),
      ];
      return () => {
        for (const stop of stops) {
          stop();
        }
      };
    },
  };
}

function unavailablePort<
  C extends WorkspaceCapability,
  Q extends WorkspaceQuery,
  I extends WorkspaceIntent,
>(capability: C): WorkspaceOwnerPort<C, Q, I> {
  const message = `${capabilityLabels[capability]} producer is unavailable.`;
  return {
    query: async () => ({ status: "unavailable", message }),
    submit: async () => ({ status: "unavailable", message }),
    subscribe: () => () => undefined,
  };
}

export function createUnavailableWorkspaceApplication(): WorkspaceApplication {
  return createWorkspaceApplication({
    conversation: unavailablePort("conversation"),
    frame: unavailablePort("frame"),
    memory: unavailablePort("memory"),
  });
}
