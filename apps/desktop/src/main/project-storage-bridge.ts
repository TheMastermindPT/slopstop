import { isDeepStrictEqual } from "node:util";
import {
  createProjectCloseCommand,
  createProjectCreateCommand,
  createProjectOpenCommand,
  type DesktopMessage,
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
import { dispatchPendingHarnessEvent, requestHarness } from "./harness-pending-request.js";
import { harnessSendFailureMessage } from "./harness-send-failure.js";
import type { HarnessSessionClient, HarnessSessionEvent } from "./harness-session.js";

type OperationKind = "open" | "create" | "close";
type PendingOperation = Readonly<{
  kind: OperationKind;
  settle(value: unknown): void;
  fail(message: string): void;
}>;

type ProjectStorageBridgeOptions = Readonly<{
  session: HarnessSessionClient;
  createId(): string;
  now(): string;
}>;

type ResultSchema<Result> = Schema.Decoder<Result>;
type RequestSchema<Request> = Schema.Decoder<Request>;

function brokenResult<Request, Result>(
  schema: ResultSchema<Result>,
  request: Request,
  message: string,
): Result {
  return decodeStrict(schema, {
    status: "broken",
    request,
    diagnostic: { code: "PROJECT_STORAGE_TRANSPORT_FAILED", message },
  });
}

function pendingOperation<
  Kind extends OperationKind,
  Request,
  Result extends Readonly<{ request: Request }>,
>(
  kind: Kind,
  request: Request,
  schema: ResultSchema<Result>,
  resolve: (result: Result) => void,
): PendingOperation {
  return {
    kind,
    settle(value) {
      const result = decodeStrict(schema, value);
      resolve(
        isDeepStrictEqual(result.request, request)
          ? result
          : brokenResult(schema, request, "Harness returned a mismatched Project Storage request."),
      );
    },
    fail: (message) => resolve(brokenResult(schema, request, message)),
  };
}

export interface ProjectStorageBridgeClient {
  open(request: ProjectStorageOpenRequest): Promise<ProjectStorageOpenResult>;
  create(request: ProjectStorageCreateRequest): Promise<ProjectStorageCreateResult>;
  close(request: ProjectStorageCloseRequest): Promise<ProjectStorageCloseResult>;
  stop(): void;
}

class ProjectStorageBridge implements ProjectStorageBridgeClient {
  readonly #createId: () => string;
  readonly #now: () => string;
  readonly #pending = new Map<string, PendingOperation>();
  readonly #session: HarnessSessionClient;
  readonly #stopSessionSubscription: () => void;
  #stopped = false;

  constructor(options: ProjectStorageBridgeOptions) {
    this.#createId = options.createId;
    this.#now = options.now;
    this.#session = options.session;
    this.#stopSessionSubscription = this.#session.subscribe((event) => {
      dispatchPendingHarnessEvent(event, {
        failAll: (message) => this.#failAll(message),
        failRequest: (causationId, message) => this.#failRequest(causationId, message),
        message: (message) => this.#handleHarnessMessage(message),
      });
    });
  }

  open(request: ProjectStorageOpenRequest): Promise<ProjectStorageOpenResult> {
    return this.#operation(
      "open",
      request,
      ProjectStorageOpenRequestSchema,
      ProjectStorageOpenResultSchema,
      () => createProjectOpenCommand(this.#metadata(), request),
    );
  }

  create(request: ProjectStorageCreateRequest): Promise<ProjectStorageCreateResult> {
    return this.#operation(
      "create",
      request,
      ProjectStorageCreateRequestSchema,
      ProjectStorageCreateResultSchema,
      () => createProjectCreateCommand(this.#metadata(), request),
    );
  }

  close(request: ProjectStorageCloseRequest): Promise<ProjectStorageCloseResult> {
    return this.#operation(
      "close",
      request,
      ProjectStorageCloseRequestSchema,
      ProjectStorageCloseResultSchema,
      () => createProjectCloseCommand(this.#metadata(), request),
    );
  }

  stop(): void {
    if (this.#stopped) return;
    this.#stopped = true;
    try {
      this.#stopSessionSubscription();
    } finally {
      this.#failAll("Project Storage bridge is stopped.");
    }
  }

  #metadata(): Readonly<{ messageId: string; sentAt: string }> {
    return { messageId: this.#createId(), sentAt: this.#now() };
  }

  #operation<Request, Result extends Readonly<{ request: Request }>>(
    kind: OperationKind,
    request: Request,
    requestSchema: RequestSchema<Request>,
    resultSchema: ResultSchema<Result>,
    createCommand: () => DesktopMessage,
  ): Promise<Result> {
    return this.#request(
      createCommand,
      (resolve) =>
        pendingOperation(kind, decodeStrict(requestSchema, request), resultSchema, resolve),
      (message) => brokenResult(resultSchema, request, message),
    );
  }

  #request<Result>(
    createCommand: () => DesktopMessage,
    createPending: (resolve: (result: Result) => void) => PendingOperation,
    broken: (message: string) => Result,
  ): Promise<Result> {
    if (this.#stopped) return Promise.resolve(broken("Project Storage bridge is stopped."));
    return requestHarness({
      pending: this.#pending,
      createCommand,
      createPending,
      broken,
      send: (command, resolve) => {
        try {
          const sent = this.#session.send(command);
          if (sent.ok) return;
          this.#pending.delete(command.messageId);
          resolve(broken(harnessSendFailureMessage(sent)));
        } catch {
          this.#pending.delete(command.messageId);
          resolve(broken("Harness session send failed."));
        }
      },
    });
  }

  #handleHarnessMessage(
    message: Extract<HarnessSessionEvent, { type: "message" }>["message"],
  ): void {
    switch (message.event) {
      case "request.failure":
        return;
      case "system.failure":
        this.#failAll("Harness reported a failure.");
        return;
      case "project.open.result":
        this.#settle(message.causationId, "open", message.payload);
        return;
      case "project.create.result":
        this.#settle(message.causationId, "create", message.payload);
        return;
      case "project.close.result":
        this.#settle(message.causationId, "close", message.payload);
        return;
      case "system.ready":
      case "workspace.intent.result":
      case "workspace.projection.invalidated":
      case "workspace.query.result":
        return;
    }
  }

  #failRequest(causationId: string, message: string): void {
    const pending = this.#pending.get(causationId);
    if (pending === undefined) return;
    this.#pending.delete(causationId);
    this.#fail(pending, message);
  }

  #settle(causationId: string | null, expected: OperationKind, value: unknown): void {
    this.#take(causationId, expected)?.settle(value);
  }

  #take(
    causationId: string | null,
    expected: PendingOperation["kind"],
  ): PendingOperation | undefined {
    if (causationId === null) {
      this.#failAll("Harness returned an uncorrelated Project Storage response.");
      return undefined;
    }
    const pending = this.#pending.get(causationId);
    if (pending === undefined) return undefined;
    this.#pending.delete(causationId);
    if (pending.kind !== expected) {
      this.#fail(pending, "Harness returned a mismatched Project Storage response.");
      return undefined;
    }
    return pending;
  }

  #failAll(message: string): void {
    const pending = [...this.#pending.values()];
    this.#pending.clear();
    for (const operation of pending) this.#fail(operation, message);
  }

  #fail(operation: PendingOperation, message: string): void {
    operation.fail(message);
  }
}

export function createProjectStorageBridge(
  options: ProjectStorageBridgeOptions,
): ProjectStorageBridgeClient {
  return new ProjectStorageBridge(options);
}
