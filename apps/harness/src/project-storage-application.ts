import type {
  ProjectStorageCloseRequest,
  ProjectStorageCloseResult,
  ProjectStorageCreateRequest,
  ProjectStorageCreateResult,
  ProjectStorageOpenRequest,
  ProjectStorageOpenResult,
} from "@slopstop/protocol";
import {
  ProjectStorageCloseResultSchema,
  ProjectStorageCreateResultSchema,
  ProjectStorageOpenResultSchema,
} from "@slopstop/protocol";

export type ProjectStorageOwnerOutcome =
  | Readonly<{ status: "ready"; result: unknown }>
  | Readonly<{ status: "unavailable"; message: string }>
  | Readonly<{ status: "broken"; message: string }>;

export type ProjectStorageActivationSession =
  | Readonly<{
      mode: "read-write";
      result: Extract<ProjectStorageOpenResult, { status: "opened" }>;
      canonicalDatabasePath: string;
      writerLeasePath: string;
      close(): Promise<void>;
    }>
  | Readonly<{
      mode: "safe-mode";
      result: Extract<ProjectStorageOpenResult, { status: "safe-mode" }>;
      close(): Promise<void>;
    }>;
export type ProjectStorageActivationOutcome =
  | Readonly<{ status: "ready"; session: ProjectStorageActivationSession }>
  | Readonly<{
      status: "not-registered";
      result: Extract<ProjectStorageOpenResult, { status: "not-registered" }>;
    }>
  | Readonly<{ status: "unavailable" | "broken"; message: string }>;
export interface ProjectStorageActivationPort {
  acquireActivation(request: ProjectStorageOpenRequest): Promise<ProjectStorageActivationOutcome>;
}
export interface ProjectStorageOwner
  extends ProjectStorageOwnerPort,
    ProjectStorageActivationPort {}

export interface ProjectStorageOwnerPort {
  open(request: ProjectStorageOpenRequest): Promise<ProjectStorageOwnerOutcome>;
  create(request: ProjectStorageCreateRequest): Promise<ProjectStorageOwnerOutcome>;
  close(request: ProjectStorageCloseRequest): Promise<ProjectStorageOwnerOutcome>;
  stop(): Promise<void>;
}

export interface ProjectStorageApplication {
  open(request: ProjectStorageOpenRequest): Promise<ProjectStorageOpenResult>;
  create(request: ProjectStorageCreateRequest): Promise<ProjectStorageCreateResult>;
  close(request: ProjectStorageCloseRequest): Promise<ProjectStorageCloseResult>;
  stop(): Promise<void>;
}

type ResultSchema<Result> = Readonly<{
  parse(value: unknown): Result;
  safeParse(
    value: unknown,
  ): Readonly<{ success: true; data: Result }> | Readonly<{ success: false }>;
}>;

type BrokenCode = "PROJECT_STORAGE_OWNER_FAILED" | "PROJECT_STORAGE_RESULT_INVALID";

type OperationContract<Request, Result> = Readonly<{
  schema: ResultSchema<Result>;
  requestMatches(result: Result, request: Request): boolean;
}>;

function messageOr(message: string, fallback: string): string {
  return message.trim().length > 0 ? message : fallback;
}

function mapOwnerOutcome<Request, Result>(
  outcome: ProjectStorageOwnerOutcome,
  request: Request,
  contract: OperationContract<Request, Result>,
): Result {
  switch (outcome.status) {
    case "ready": {
      const parsed = contract.schema.safeParse(outcome.result);
      return parsed.success && contract.requestMatches(parsed.data, request)
        ? parsed.data
        : brokenResult(
            request,
            "PROJECT_STORAGE_RESULT_INVALID",
            "Project Storage owner returned an invalid result.",
            contract.schema,
          );
    }
    case "unavailable":
      return unavailableResult(
        request,
        messageOr(outcome.message, "Project Storage owner is unavailable."),
        contract.schema,
      );
    case "broken":
      return brokenResult(
        request,
        "PROJECT_STORAGE_OWNER_FAILED",
        messageOr(outcome.message, "Project Storage owner failed."),
        contract.schema,
      );
  }
}

async function invokeOwner<Request, Result>(
  operation: (request: Request) => Promise<ProjectStorageOwnerOutcome>,
  request: Request,
  contract: OperationContract<Request, Result>,
): Promise<Result> {
  try {
    return mapOwnerOutcome(await operation(request), request, contract);
  } catch {
    return brokenResult(
      request,
      "PROJECT_STORAGE_OWNER_FAILED",
      "Project Storage owner failed.",
      contract.schema,
    );
  }
}

function unavailableResult<Request, Result>(
  request: Request,
  message: string,
  schema: ResultSchema<Result>,
): Result {
  return schema.parse({
    status: "unavailable",
    request,
    diagnostic: { code: "PROJECT_STORAGE_UNAVAILABLE", message },
  });
}

function brokenResult<Request, Result>(
  request: Request,
  code: BrokenCode,
  message: string,
  schema: ResultSchema<Result>,
): Result {
  return schema.parse({
    status: "broken",
    request,
    diagnostic: { code, message },
  });
}

const openContract: OperationContract<ProjectStorageOpenRequest, ProjectStorageOpenResult> = {
  schema: ProjectStorageOpenResultSchema,
  requestMatches: (result, request) => result.request.projectId === request.projectId,
};

const createContract: OperationContract<ProjectStorageCreateRequest, ProjectStorageCreateResult> = {
  schema: ProjectStorageCreateResultSchema,
  requestMatches: (result, request) =>
    result.request.projectId === request.projectId &&
    result.request.createRequestId === request.createRequestId,
};

const closeContract: OperationContract<ProjectStorageCloseRequest, ProjectStorageCloseResult> = {
  schema: ProjectStorageCloseResultSchema,
  requestMatches: (result, request) => result.request.projectId === request.projectId,
};

export function createProjectStorageApplication(
  owner: ProjectStorageOwnerPort,
): ProjectStorageApplication {
  return {
    open: (request) => invokeOwner((value) => owner.open(value), request, openContract),
    create: (request) => invokeOwner((value) => owner.create(value), request, createContract),
    close: (request) => invokeOwner((value) => owner.close(value), request, closeContract),
    stop: () => owner.stop(),
  };
}

export function createUnavailableProjectStorageApplication(): ProjectStorageApplication {
  const message = "Project Storage owner is unavailable.";
  const owner: ProjectStorageOwnerPort = {
    open: async () => ({ status: "unavailable", message }),
    create: async () => ({ status: "unavailable", message }),
    close: async () => ({ status: "unavailable", message }),
    stop: () => Promise.resolve(),
  };
  return createProjectStorageApplication(owner);
}
