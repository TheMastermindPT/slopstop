import {
  createProjectCloseCommand,
  createProjectCreateCommand,
  createProjectOpenCommand,
  decodeStrict,
  type ProjectStorageCloseRequest,
  ProjectStorageCloseRequestSchema,
  type ProjectStorageCloseResult,
  ProjectStorageCloseResultSchema,
  type ProjectStorageCreateRequest,
  ProjectStorageCreateRequestSchema,
  type ProjectStorageCreateResult,
  ProjectStorageCreateResultSchema,
  type ProjectStorageOpenRequest,
  ProjectStorageOpenRequestSchema,
  type ProjectStorageOpenResult,
  ProjectStorageOpenResultSchema,
} from "@slopstop/protocol";
import type { Schema } from "effect";
import {
  type BridgeOperation,
  bridgeFaultText,
  bridgeRequest,
  type Clock,
  type HarnessRequestCore,
} from "./harness-request-core.js";

const stoppedText = "Project Storage bridge is stopped.";

function brokenResult<Request, Result>(
  schema: Schema.Decoder<Result>,
  request: Request,
  message: string,
): Result {
  return decodeStrict(schema, {
    status: "broken",
    request,
    diagnostic: { code: "PROJECT_STORAGE_TRANSPORT_FAILED", message },
  });
}

export interface ProjectStorageBridgeClient {
  open(request: ProjectStorageOpenRequest): Promise<ProjectStorageOpenResult>;
  create(request: ProjectStorageCreateRequest): Promise<ProjectStorageCreateResult>;
  close(request: ProjectStorageCloseRequest): Promise<ProjectStorageCloseResult>;
  stop(): void;
}

/** The Project Storage bridge over a request core. */
export function projectStorageBridgeOver(
  core: HarnessRequestCore,
  clock: Clock,
): ProjectStorageBridgeClient {
  let stopped = false;
  const bridge = { tag: "project-storage", isStopped: () => stopped } as const;
  const metadata = () => ({ messageId: clock.createId(), sentAt: clock.now() });
  /** A storage operation: its result echoes the request, and every fault answers broken. */
  const operation = <Request, Result extends Readonly<{ request: Request }>>(
    requestSchema: Schema.Decoder<Request>,
    resultSchema: Schema.Decoder<Result>,
    command: BridgeOperation<Request, Result>["command"],
    event: BridgeOperation<Request, Result>["event"],
  ): BridgeOperation<Request, Result> => ({
    requestSchema,
    command,
    event,
    resultSchema,
    echo: { reply: (result) => result.request },
    broken: (request, fault) =>
      brokenResult(
        resultSchema,
        request,
        bridgeFaultText(fault, {
          noun: "Project Storage",
          stopped: stoppedText,
          echo: "Harness returned a mismatched Project Storage request.",
        }),
      ),
  });
  const open = operation(
    ProjectStorageOpenRequestSchema,
    ProjectStorageOpenResultSchema,
    (request) => createProjectOpenCommand(metadata(), request),
    "project.open.result",
  );
  const create = operation(
    ProjectStorageCreateRequestSchema,
    ProjectStorageCreateResultSchema,
    (request) => createProjectCreateCommand(metadata(), request),
    "project.create.result",
  );
  const close = operation(
    ProjectStorageCloseRequestSchema,
    ProjectStorageCloseResultSchema,
    (request) => createProjectCloseCommand(metadata(), request),
    "project.close.result",
  );
  return {
    open: (request) => bridgeRequest(core, bridge, open, request),
    create: (request) => bridgeRequest(core, bridge, create, request),
    close: (request) => bridgeRequest(core, bridge, close, request),
    stop: () => {
      stopped = true;
      core.failBridge("project-storage", { kind: "stopped" });
    },
  };
}
