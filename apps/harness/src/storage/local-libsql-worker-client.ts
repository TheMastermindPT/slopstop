import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import type { InArgs, InStatement } from "@libsql/client";
import { Result, Schema } from "effect";

// Self-contained like the worker it hosts: child-process tests load this module directly.
const strictParseOptions = { errors: "all", onExcessProperty: "error" } as const;
const NonEmptyTextSchema = Schema.String.check(Schema.isMinLength(1));

const ArrayBufferSchema = Schema.declare(
  (value: unknown): value is ArrayBuffer => value instanceof ArrayBuffer,
);
const sqlValueSchema = Schema.Union([
  Schema.Null,
  Schema.String,
  Schema.Finite,
  Schema.BigInt,
  ArrayBufferSchema,
]);

const resultSetSchema = Schema.Struct({
  columns: Schema.Array(Schema.String),
  rows: Schema.Array(Schema.Array(sqlValueSchema)),
  rowsAffected: Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
  lastInsertRowid: Schema.NullOr(Schema.BigInt),
});

const workerErrorSchema = Schema.Struct({
  name: NonEmptyTextSchema,
  message: Schema.String,
  code: Schema.optional(Schema.String),
});

const RequestIdSchema = Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0));
const workerResponseSchema = Schema.Union([
  Schema.Struct({ type: Schema.Literal("ready") }),
  Schema.Struct({
    type: Schema.Literal("success"),
    requestId: RequestIdSchema,
    result: Schema.Unknown,
  }),
  Schema.Struct({
    type: Schema.Literal("failure"),
    requestId: RequestIdSchema,
    error: workerErrorSchema,
  }),
  Schema.Struct({ type: Schema.Literal("fatal"), error: workerErrorSchema }),
]);

const PositiveIntegerSchema = Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0));
const transactionIdSchema = PositiveIntegerSchema;
const clientIdSchema = PositiveIntegerSchema;
const nullResultSchema = Schema.Null;

type WorkerResultSchema = Schema.ConstraintDecoder<unknown>;

export type LocalLibsqlResultSet = typeof resultSetSchema.Type;

export interface LocalLibsqlTransaction {
  readonly closed: boolean;
  execute(statement: InStatement, args?: InArgs): Promise<LocalLibsqlResultSet>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  close(): Promise<void>;
}

export interface LocalLibsqlClient {
  execute(statement: InStatement, args?: InArgs): Promise<LocalLibsqlResultSet>;
  transaction(mode: "write"): Promise<LocalLibsqlTransaction>;
  close(): Promise<void>;
}

type PendingRequest = Readonly<{
  resolve(value: unknown): void;
  reject(reason: unknown): void;
}>;

type ClientWorkerRequest =
  | Readonly<{
      operation: "execute";
      transactionId: number | null;
      statement: InStatement;
    }>
  | Readonly<{ operation: "begin"; mode: "write" }>
  | Readonly<{
      operation: "commit" | "rollback" | "close-transaction";
      transactionId: number;
    }>;

type WorkerRequest =
  | Readonly<{ operation: "open-client"; url: string }>
  | (ClientWorkerRequest & Readonly<{ clientId: number }>)
  | Readonly<{ operation: "close-client"; clientId: number }>;

type WorkerModuleUrls = Readonly<{
  libsqlClient: string;
  effect: string;
}>;

function resolveWorkerModuleUrl(packageName: string, entryPath: string): string {
  const processEntry = process.argv[1];
  let current =
    processEntry === undefined ? import.meta.dirname : path.dirname(path.resolve(processEntry));
  for (;;) {
    const candidate = path.join(current, "node_modules", ...packageName.split("/"), entryPath);
    if (existsSync(candidate)) return pathToFileURL(candidate).href;
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error(`Local libSQL worker cannot resolve ${packageName}.`);
    }
    current = parent;
  }
}

const workerModuleUrls: WorkerModuleUrls = {
  libsqlClient: resolveWorkerModuleUrl("@libsql/client", "lib-esm/node.js"),
  effect: resolveWorkerModuleUrl("effect", "dist/index.js"),
};

const workerSource = `
const { runInNewContext } = require("node:vm");
const { setFlagsFromString } = require("node:v8");
const { parentPort, workerData } = require("node:worker_threads");

const errorString = (error, property) => {
  if (typeof error !== "object" || error === null) return undefined;
  const value = error[property];
  return typeof value === "string" ? value : undefined;
};
const serializeError = (error, fallbackMessage = "Local libSQL operation failed.") => {
  const name = errorString(error, "name") ?? "Error";
  const message = errorString(error, "message") ?? fallbackMessage;
  const code = errorString(error, "code");
  return code === undefined ? { name, message } : { name, message, code };
};

void (async () => {
  setFlagsFromString("--expose_gc");
  const collectGarbage = runInNewContext("gc");
  const [{ createClient }, { Schema }] = await Promise.all([
    import(workerData.libsqlClient),
    import(workerData.effect),
  ]);
  const port = parentPort;
  if (port === null) throw new Error("Local libSQL worker has no parent port.");

  const strict = { errors: "all", onExcessProperty: "error" };
  const instanceOf = (type) => Schema.declare((value) => value instanceof type);
  const inputValueSchema = Schema.Union([
    Schema.Null,
    Schema.String,
    Schema.Finite,
    Schema.BigInt,
    instanceOf(ArrayBuffer),
    Schema.Boolean,
    instanceOf(Uint8Array),
    instanceOf(Date),
  ]);
  const argsSchema = Schema.Union([
    Schema.Array(inputValueSchema),
    Schema.Record(Schema.String, inputValueSchema),
  ]);
  const nonEmptyText = Schema.String.check(Schema.isMinLength(1));
  const statementSchema = Schema.Union([
    nonEmptyText,
    Schema.Struct({ sql: nonEmptyText, args: Schema.optional(argsSchema) }),
  ]);
  const integer = Schema.Number.check(Schema.isInt());
  const requestIdSchema = integer.check(Schema.isGreaterThanOrEqualTo(0));
  const clientIdSchema = integer.check(Schema.isGreaterThan(0));
  const transactionIdSchema = integer.check(Schema.isGreaterThan(0));
  const urlSchema = Schema.String.check(Schema.makeFilter((value) => URL.canParse(value)));
  const requestSchema = Schema.Union([
    Schema.Struct({
      operation: Schema.Literal("open-client"),
      requestId: requestIdSchema,
      url: urlSchema,
    }),
    Schema.Struct({
      operation: Schema.Literal("execute"),
      requestId: requestIdSchema,
      clientId: clientIdSchema,
      transactionId: Schema.NullOr(transactionIdSchema),
      statement: statementSchema,
    }),
    Schema.Struct({
      operation: Schema.Literal("begin"),
      requestId: requestIdSchema,
      clientId: clientIdSchema,
      mode: Schema.Literal("write"),
    }),
    Schema.Struct({
      operation: Schema.Literals(["commit", "rollback", "close-transaction"]),
      requestId: requestIdSchema,
      clientId: clientIdSchema,
      transactionId: transactionIdSchema,
    }),
    Schema.Struct({
      operation: Schema.Literal("close-client"),
      requestId: requestIdSchema,
      clientId: clientIdSchema,
    }),
  ]);
  const decodeRequest = Schema.decodeUnknownSync(requestSchema, strict);
  const clients = new Map();
  const transactions = new Map();
  let nextClientId = 1;
  let nextTransactionId = 1;

  const resultSet = (result) => ({
    columns: [...result.columns],
    rows: result.rows.map((row) => Array.from(row)),
    rowsAffected: result.rowsAffected,
    lastInsertRowid: result.lastInsertRowid ?? null,
  });
  const requireClient = (clientId) => {
    const client = clients.get(clientId);
    if (client === undefined) throw new Error("Local libSQL client is unavailable.");
    return client;
  };
  const requireTransaction = (clientId, transactionId) => {
    const entry = transactions.get(transactionId);
    if (entry === undefined || entry.clientId !== clientId) {
      throw new Error("Local libSQL transaction is unavailable.");
    }
    return entry.transaction;
  };
  const finishTransaction = async (clientId, transactionId, operation) => {
    const transaction = requireTransaction(clientId, transactionId);
    await transaction[operation]();
    transactions.delete(transactionId);
    return null;
  };
  const closeTransaction = (clientId, transactionId) => {
    const entry = transactions.get(transactionId);
    if (entry === undefined) return null;
    if (entry.clientId !== clientId) {
      throw new Error("Local libSQL transaction is unavailable.");
    }
    entry.transaction.close();
    transactions.delete(transactionId);
    return null;
  };
  const closeClient = async (clientId) => {
    const client = requireClient(clientId);
    for (const [transactionId, entry] of transactions) {
      if (entry.clientId !== clientId) continue;
      entry.transaction.close();
      transactions.delete(transactionId);
    }
    client.close();
    clients.delete(clientId);
    // libsql releases Windows file handles from native finalizers, not close(). Collect on
    // every close: other clients staying open must not keep this client's files locked.
    collectGarbage();
    await new Promise((resolve) => setTimeout(resolve, 10));
    return null;
  };
  const handleClientRequest = async (request) => {
    switch (request.operation) {
      case "execute": {
        const executor = request.transactionId === null
          ? requireClient(request.clientId)
          : requireTransaction(request.clientId, request.transactionId);
        return resultSet(await executor.execute(request.statement));
      }
      case "begin": {
        const transaction = await requireClient(request.clientId).transaction(request.mode);
        const transactionId = nextTransactionId++;
        transactions.set(transactionId, { clientId: request.clientId, transaction });
        return transactionId;
      }
      case "commit":
        return finishTransaction(request.clientId, request.transactionId, "commit");
      case "rollback":
        return finishTransaction(request.clientId, request.transactionId, "rollback");
      case "close-transaction":
        return closeTransaction(request.clientId, request.transactionId);
    }
  };
  const handle = async (request) => {
    if (request.operation === "open-client") {
      const clientId = nextClientId++;
      clients.set(clientId, createClient({ url: request.url }));
      return clientId;
    }
    if (request.operation === "close-client") return closeClient(request.clientId);
    return handleClientRequest(request);
  };

  let queue = Promise.resolve();
  port.on("message", (value) => {
    queue = queue.then(async () => {
      let requestId;
      try {
        const request = decodeRequest(value);
        requestId = request.requestId;
        const result = await handle(request);
        port.postMessage({ type: "success", requestId, result });
      } catch (error) {
        if (requestId === undefined) {
          port.postMessage({ type: "fatal", error: serializeError(error) });
          port.close();
          return;
        }
        port.postMessage({ type: "failure", requestId, error: serializeError(error) });
      }
    });
  });
  port.postMessage({ type: "ready" });
})().catch((error) => {
  parentPort?.postMessage({
    type: "fatal",
    error: serializeError(error, "Local libSQL worker failed."),
  });
});
`;

function normalizeStatement(statement: InStatement, args: InArgs | undefined): InStatement {
  if (typeof statement !== "string") return statement;
  return args === undefined ? statement : { sql: statement, args };
}

function deserializeWorkerError(input: typeof workerErrorSchema.Type): Error {
  const error = new Error(input.message);
  error.name = input.name;
  if (input.code !== undefined) Reflect.set(error, "code", input.code);
  return error;
}

class WorkerLocalLibsqlTransaction implements LocalLibsqlTransaction {
  #closed = false;

  constructor(
    private readonly client: WorkerLocalLibsqlClient,
    private readonly transactionId: number,
  ) {}

  get closed(): boolean {
    return this.#closed;
  }

  execute(statement: InStatement, args?: InArgs): Promise<LocalLibsqlResultSet> {
    if (this.#closed) return Promise.reject(new Error("Local libSQL transaction is closed."));
    return this.client.executeInTransaction(
      this.transactionId,
      normalizeStatement(statement, args),
    );
  }

  async commit(): Promise<void> {
    await this.finish("commit");
  }

  async rollback(): Promise<void> {
    await this.finish("rollback");
  }

  async close(): Promise<void> {
    if (this.#closed) return;
    await this.finish("close-transaction");
  }

  private async finish(operation: "commit" | "rollback" | "close-transaction"): Promise<void> {
    if (this.#closed) throw new Error("Local libSQL transaction is closed.");
    await this.client.request({ operation, transactionId: this.transactionId }, nullResultSchema);
    this.#closed = true;
  }
}

class LocalLibsqlWorkerBroker {
  readonly #worker: Worker;
  readonly #pending = new Map<number, PendingRequest>();
  readonly #ready: Promise<void>;
  #resolveReady: () => void = () => undefined;
  #rejectReady: (reason: unknown) => void = () => undefined;
  #readySettled = false;
  #nextRequestId = 0;
  #failure: unknown;

  constructor(private readonly onFailure: () => void) {
    this.#ready = new Promise<void>((resolve, reject) => {
      this.#resolveReady = resolve;
      this.#rejectReady = reject;
    });
    this.#worker = new Worker(workerSource, { eval: true, workerData: workerModuleUrls });
    this.#worker.on("message", (message: unknown) => this.receive(message));
    this.#worker.once("error", (error) => this.fail(error));
    this.#worker.once("exit", () => {
      this.fail(new Error("Local libSQL worker exited unexpectedly."));
      this.onFailure();
    });
  }

  async request<S extends WorkerResultSchema>(
    request: WorkerRequest,
    schema: S,
  ): Promise<S["Type"]> {
    await this.#ready;
    if (this.#failure !== undefined) throw this.#failure;
    const requestId = this.#nextRequestId++;
    const response = new Promise<unknown>((resolve, reject) => {
      this.#pending.set(requestId, { resolve, reject });
    });
    this.#worker.ref();
    try {
      this.#worker.postMessage({ ...request, requestId });
    } catch (error) {
      this.#pending.delete(requestId);
      this.releaseWhenIdle();
      throw error;
    }
    return Schema.decodeUnknownSync(schema, strictParseOptions)(await response);
  }

  private receive(value: unknown): void {
    const parsed = Schema.decodeUnknownResult(workerResponseSchema, strictParseOptions)(value);
    if (Result.isFailure(parsed)) {
      this.fail(new Error("Local libSQL worker returned an invalid response."));
      return;
    }
    const response = parsed.success;
    if (response.type === "ready") {
      if (this.#readySettled) {
        this.fail(new Error("Local libSQL worker initialized more than once."));
        return;
      }
      this.#readySettled = true;
      this.#resolveReady();
      this.releaseWhenIdle();
      return;
    }
    if (response.type === "fatal") {
      this.fail(deserializeWorkerError(response.error));
      return;
    }
    const pending = this.#pending.get(response.requestId);
    if (pending === undefined) {
      this.fail(new Error("Local libSQL worker response has no pending request."));
      return;
    }
    this.#pending.delete(response.requestId);
    if (response.type === "failure") {
      pending.reject(deserializeWorkerError(response.error));
    } else {
      pending.resolve(response.result);
    }
    this.releaseWhenIdle();
  }

  private fail(error: unknown): void {
    if (this.#failure !== undefined) return;
    this.#failure = error;
    if (!this.#readySettled) {
      this.#readySettled = true;
      this.#rejectReady(error);
    }
    for (const pending of this.#pending.values()) pending.reject(error);
    this.#pending.clear();
    this.#worker.unref();
    void this.#worker.terminate().catch(() => undefined);
  }

  private releaseWhenIdle(): void {
    if (this.#pending.size === 0) this.#worker.unref();
  }
}

type LocalLibsqlWorkerPool = "application" | "generation";

const sharedBrokers = new Map<LocalLibsqlWorkerPool, LocalLibsqlWorkerBroker>();

function getSharedBroker(pool: LocalLibsqlWorkerPool): LocalLibsqlWorkerBroker {
  const current = sharedBrokers.get(pool);
  if (current !== undefined) return current;
  let broker: LocalLibsqlWorkerBroker;
  broker = new LocalLibsqlWorkerBroker(() => {
    if (sharedBrokers.get(pool) === broker) sharedBrokers.delete(pool);
  });
  sharedBrokers.set(pool, broker);
  return broker;
}

class WorkerLocalLibsqlClient implements LocalLibsqlClient {
  readonly #broker: LocalLibsqlWorkerBroker;
  readonly #clientId: Promise<number>;
  #closing = false;
  #closePromise: Promise<void> | undefined;

  constructor(databasePath: string, pool: LocalLibsqlWorkerPool) {
    this.#broker = getSharedBroker(pool);
    this.#clientId = this.#broker.request(
      { operation: "open-client", url: pathToFileURL(databasePath).href },
      clientIdSchema,
    );
  }

  execute(statement: InStatement, args?: InArgs): Promise<LocalLibsqlResultSet> {
    return this.request(
      {
        operation: "execute",
        transactionId: null,
        statement: normalizeStatement(statement, args),
      },
      resultSetSchema,
    );
  }

  async transaction(mode: "write"): Promise<LocalLibsqlTransaction> {
    const transactionId = await this.request({ operation: "begin", mode }, transactionIdSchema);
    return new WorkerLocalLibsqlTransaction(this, transactionId);
  }

  executeInTransaction(
    transactionId: number,
    statement: InStatement,
  ): Promise<LocalLibsqlResultSet> {
    return this.request({ operation: "execute", transactionId, statement }, resultSetSchema);
  }

  async request<S extends WorkerResultSchema>(
    request: ClientWorkerRequest,
    schema: S,
  ): Promise<S["Type"]> {
    if (this.#closing) throw new Error("Local libSQL client is closed.");
    const clientId = await this.#clientId;
    return this.#broker.request({ ...request, clientId }, schema);
  }

  close(): Promise<void> {
    if (this.#closePromise !== undefined) return this.#closePromise;
    this.#closing = true;
    const attempt = this.closeClient();
    this.#closePromise = attempt;
    void attempt.catch(() => {
      if (this.#closePromise === attempt) this.#closePromise = undefined;
    });
    return attempt;
  }

  private async closeClient(): Promise<void> {
    const clientId = await this.#clientId;
    await this.#broker.request({ operation: "close-client", clientId }, nullResultSchema);
  }
}

export function createWorkerLocalLibsqlClient(
  databasePath: string,
  pool: LocalLibsqlWorkerPool,
): LocalLibsqlClient {
  return new WorkerLocalLibsqlClient(databasePath, pool);
}
