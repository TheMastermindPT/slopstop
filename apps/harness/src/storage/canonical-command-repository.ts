import type { ProjectActivationId, ProjectId, WriterGeneration } from "@slopstop/protocol";
import { decodeStrict, UuidTextSchema, WriterGenerationSchema } from "@slopstop/protocol";
import { Schema } from "effect";
import {
  type CanonicalCommandSnapshot,
  canonicalChangedOnce as changedOnce,
  CanonicalSha256Schema as digestSchema,
  hashCanonicalJson,
  canonicalResultObjects as objects,
  canonicalExactlyOne as one,
  readCanonicalCommandSnapshot,
} from "../canonical-json.js";
import {
  coherentCanonicalWriterRelease as coherentRelease,
  currentCanonicalSettlementFence as currentSettlementFence,
  canonicalWriterFenceSchema as fenceSchema,
  readCanonicalWriterFence,
  canonicalWriterUtcInstantSchema as utcInstantSchema,
} from "./canonical-command-ledger.js";
import type {
  CanonicalCommandSettlementResult,
  CanonicalSettlementDependencies,
} from "./canonical-command-settlement.js";
import { settleFirstCanonicalCommand } from "./canonical-command-settlement.js";
import {
  type CanonicalUncertaintyDescriptor,
  inspectCanonicalRecovery,
  type PreparedCanonicalUncertainty,
  prepareCanonicalUncertainty,
  recordCanonicalUncertainty,
  resolveCanonicalRecovery,
} from "./canonical-writer-recovery.js";
import type { LocalLibsqlClient, LocalLibsqlTransaction } from "./local-libsql-worker-client.js";
import {
  runClassifiedWriteTransaction,
  withWriteTransaction,
} from "./project-storage-transaction.js";

export const WriterCapabilityTokenSchema = digestSchema.pipe(Schema.brand("WriterCapabilityToken"));
export type WriterCapabilityToken = typeof WriterCapabilityTokenSchema.Type;
export type WriterFenceCheck = Readonly<{ status: "current" }> | Readonly<{ status: "stale" }>;
export interface CanonicalCommandRepository {
  readonly projectId: ProjectId;
  readonly writerGeneration: WriterGeneration;
  verifyFence(): Promise<WriterFenceCheck>;
  settle(commandText: string): Promise<CanonicalCommandSettlementResult>;
  releaseFence(releasedAt: string): Promise<WriterFenceCheck>;
  close(): Promise<void>;
}
export type CanonicalCommandRepositoryFailureCode =
  | "WRITER_FENCE_ACTIVATION_FAILED"
  | "WRITER_FENCE_CHECK_FAILED"
  | "WRITER_FENCE_RELEASE_FAILED"
  | "WRITER_REPOSITORY_CLOSE_FAILED";
export type CanonicalCommandRepositoryActivationResult =
  | Readonly<{
      status: "activated";
      repository: CanonicalCommandRepository;
      writerGeneration: WriterGeneration;
    }>
  | Readonly<{
      status: "broken";
      error: Error & { code: CanonicalCommandRepositoryFailureCode };
      cleanup?: Readonly<{ close(): Promise<void> }>;
    }>;
export type CanonicalCommandRepositoryFactoryDependencies = CanonicalSettlementDependencies &
  Readonly<{
    openClient(path: string): LocalLibsqlClient;
    sha256Text(value: string): Promise<string>;
    createHandoffId(): string;
    createRecoveryRecordId(): string;
  }>;
type CanonicalRepositoryActivationInput = Readonly<{
  canonicalDatabasePath: string;
  projectId: ProjectId;
  activationId: ProjectActivationId;
  writerToken: WriterCapabilityToken;
  activatedAt: string;
}>;
export interface CanonicalCommandRepositoryFactory {
  activate(
    input: CanonicalRepositoryActivationInput,
  ): Promise<CanonicalCommandRepositoryActivationResult>;
}
const messages = {
  WRITER_FENCE_ACTIVATION_FAILED: "Canonical Writer fence activation failed.",
  WRITER_FENCE_CHECK_FAILED: "Canonical Writer fence verification failed.",
  WRITER_FENCE_RELEASE_FAILED: "Canonical Writer fence release failed.",
  WRITER_REPOSITORY_CLOSE_FAILED: "Canonical Writer repository close failed.",
} as const;
export class CanonicalCommandRepositoryError extends Error {
  override readonly name = "CanonicalCommandRepositoryError";
  constructor(
    readonly code: CanonicalCommandRepositoryFailureCode,
    options?: ErrorOptions,
  ) {
    super(messages[code], options);
  }
}

const identitySchema = UuidTextSchema.check(
  Schema.makeFilter((value: string) => value === value.toLowerCase()),
);
const SqlCountSchema = Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0));
const summaryRowsSchema = Schema.Array(
  Schema.Struct({
    last: SqlCountSchema,
    count: SqlCountSchema,
    maximum: Schema.NullOr(WriterGenerationSchema),
  }),
);
const foreignKeysRowsSchema = Schema.Array(Schema.Struct({ foreign_keys: Schema.Literal(1) }));
const fenceRowsSchema = Schema.Array(fenceSchema);
type PriorFence = NonNullable<Awaited<ReturnType<typeof readCanonicalWriterFence>>>;

function configuredClient(client: LocalLibsqlClient): LocalLibsqlClient {
  return {
    execute: (statement, args) => client.execute(statement, args),
    close: () => client.close(),
    transaction: async (mode) => {
      await client.execute("PRAGMA foreign_keys = ON");
      await client.execute("PRAGMA busy_timeout = 5000");
      one(
        decodeStrict(foreignKeysRowsSchema, objects(await client.execute("PRAGMA foreign_keys"))),
      );
      return client.transaction(mode);
    },
  };
}

async function readFenceRows(
  executor: Pick<LocalLibsqlClient, "execute">,
  projectId: ProjectId,
): Promise<readonly (typeof fenceSchema.Type)[]> {
  return decodeStrict(
    fenceRowsSchema,
    objects(
      await executor.execute({
        sql: `SELECT f.writer_generation AS generation, f.token_digest AS tokenDigest, f.state,
          f.activated_at AS activatedAt, f.released_at AS releasedAt,
          g.writer_generation AS generationNumber, g.token_digest AS generationDigest,
          g.acquired_at AS generationAcquiredAt, g.released_at AS generationReleasedAt
          FROM writer_fence AS f LEFT JOIN writer_generations AS g
          ON g.project_id=f.project_id AND g.writer_generation=f.writer_generation WHERE f.project_id=?`,
        args: [projectId],
      }),
    ),
  );
}

async function priorFence(
  tx: LocalLibsqlTransaction,
  projectId: ProjectId,
): Promise<PriorFence | undefined> {
  const summary = one(
    decodeStrict(
      summaryRowsSchema,
      objects(
        await tx.execute({
          sql: `SELECT last_writer_generation AS last,
      (SELECT COUNT(*) FROM writer_generations WHERE project_id=?) AS count,
      (SELECT MAX(writer_generation) FROM writer_generations WHERE project_id=?) AS maximum
      FROM project_state WHERE project_id=?`,
          args: [projectId, projectId, projectId],
        }),
      ),
    ),
  );
  const fences = await readFenceRows(tx, projectId);
  if (summary.last === 0) {
    const empty = [summary.count === 0, summary.maximum === null, fences.length === 0].every(
      Boolean,
    );
    if (!empty) throw new Error("Initial Writer state is inconsistent.");
    return undefined;
  }
  const fence = one(fences);
  const coherent = [
    summary.count === summary.last,
    summary.maximum === summary.last,
    fence.generation === summary.last,
    fence.generationNumber === summary.last,
    fence.tokenDigest === fence.generationDigest,
    coherentRelease(fence),
  ].every(Boolean);
  if (!coherent) throw new Error("Prior Writer state is inconsistent.");
  const checked = one(
    [await readCanonicalWriterFence(tx, projectId)].filter((row) => row !== undefined),
  );
  if (checked.generation !== summary.last)
    throw new Error("Prior Writer fence is missing or inconsistent.");
  return checked;
}

type ActivationTransaction = Readonly<{
  tx: LocalLibsqlTransaction;
  input: CanonicalRepositoryActivationInput;
  digest: string;
  dependencies: CanonicalCommandRepositoryFactoryDependencies;
}>;

async function recordHandoff(
  context: ActivationTransaction,
  generation: WriterGeneration,
  previous: PriorFence | undefined,
  recovering: boolean,
): Promise<void> {
  const { tx, input, dependencies } = context;
  let kind = "initial";
  if (previous !== undefined) kind = recovering ? "recovery" : "clean";
  changedOnce(
    await tx.execute({
      sql: "INSERT INTO writer_handoffs (project_id,handoff_id,from_writer_generation,to_writer_generation,kind,recorded_at) VALUES (?,?,?,?,?,?)",
      args: [
        input.projectId,
        decodeStrict(identitySchema, dependencies.createHandoffId()),
        previous?.generation ?? null,
        generation,
        kind,
        input.activatedAt,
      ],
    }),
  );
}

async function recordRecovery(
  context: ActivationTransaction,
  generation: WriterGeneration,
  previous: PriorFence,
  recovery: Awaited<ReturnType<typeof inspectCanonicalRecovery>>,
): Promise<void> {
  const { tx, input, dependencies } = context;
  if (previous.state === "active")
    changedOnce(
      await tx.execute({
        sql: "UPDATE writer_generations SET released_at=? WHERE project_id=? AND writer_generation=? AND token_digest=? AND released_at IS NULL",
        args: [input.activatedAt, input.projectId, previous.generation, previous.tokenDigest],
      }),
    );
  if (recovery !== undefined) {
    await resolveCanonicalRecovery(tx, recovery, generation, input.activatedAt);
    return;
  }
  changedOnce(
    await tx.execute({
      sql: `INSERT INTO writer_recovery_records (project_id,recovery_record_id,writer_generation,reason,command_id,command_fingerprint,observed_at,resolution,resolved_by_writer_generation,resolved_at)
      VALUES (?,?,?,'abandoned-active-fence',NULL,NULL,?,'generation-superseded',?,?)`,
      args: [
        input.projectId,
        decodeStrict(identitySchema, dependencies.createRecoveryRecordId()),
        previous.generation,
        input.activatedAt,
        generation,
        input.activatedAt,
      ],
    }),
  );
}

async function activateFence(context: ActivationTransaction): Promise<WriterGeneration> {
  const { tx, input, digest } = context;
  const previous = await priorFence(tx, input.projectId);
  const recovery = await inspectCanonicalRecovery(tx, input.projectId, previous);
  const last = previous?.generation ?? 0;
  const generation = decodeStrict(WriterGenerationSchema, last + 1);
  changedOnce(
    await tx.execute({
      sql: "UPDATE project_state SET last_writer_generation=?, updated_at=? WHERE project_id=? AND last_writer_generation=?",
      args: [generation, input.activatedAt, input.projectId, last],
    }),
  );
  changedOnce(
    await tx.execute({
      sql: "INSERT INTO writer_generations (project_id,writer_generation,activation_id,token_digest,acquired_at,released_at) VALUES (?,?,?,?,?,NULL)",
      args: [input.projectId, generation, input.activationId, digest, input.activatedAt],
    }),
  );
  const recovering = previous?.state === "active" || recovery !== undefined;
  if (previous !== undefined && recovering)
    await recordRecovery(context, generation, previous, recovery);
  await recordHandoff(context, generation, previous, recovering);
  if (previous === undefined) {
    changedOnce(
      await tx.execute({
        sql: "INSERT INTO writer_fence (project_id,writer_generation,token_digest,state,activated_at,released_at) VALUES (?,?,?,'active',?,NULL)",
        args: [input.projectId, generation, digest, input.activatedAt],
      }),
    );
  } else {
    changedOnce(
      await tx.execute({
        sql: "UPDATE writer_fence SET writer_generation=?, token_digest=?, state='active', activated_at=?, released_at=NULL WHERE project_id=? AND writer_generation=? AND token_digest=? AND state=? AND released_at IS ?",
        args: [
          generation,
          digest,
          input.activatedAt,
          input.projectId,
          previous.generation,
          previous.tokenDigest,
          previous.state,
          previous.releasedAt,
        ],
      }),
    );
  }
  return generation;
}

class CanonicalTransactionOwner {
  private busy = false;
  private closed = false;
  private unfinished: LocalLibsqlTransaction | undefined;

  constructor(readonly client: LocalLibsqlClient) {}

  get hasUnfinishedTransaction(): boolean {
    return this.unfinished !== undefined;
  }

  private async closeTransaction(): Promise<void> {
    const tx = this.unfinished;
    if (tx === undefined) return;
    await tx.close();
    if (!tx.closed) throw new Error("Canonical Writer transaction close was not acknowledged.");
    this.unfinished = undefined;
  }

  async transaction(mode: "write"): Promise<LocalLibsqlTransaction> {
    const tx = await this.client.transaction(mode);
    this.unfinished = tx;
    return {
      get closed() {
        return tx.closed;
      },
      execute: (statement, args) => tx.execute(statement, args),
      commit: () => tx.commit(),
      rollback: () => tx.rollback(),
      close: () => this.closeTransaction(),
    };
  }

  async exclusively<T>(operation: () => Promise<T>): Promise<T> {
    if (this.busy) throw new Error("Canonical Writer transaction is already owned.");
    this.busy = true;
    try {
      await this.closeTransaction();
      return await operation();
    } finally {
      this.busy = false;
    }
  }

  async close(beforeClose: () => Promise<void> = async () => {}): Promise<void> {
    await this.exclusively(async () => {
      if (this.closed) return;
      await beforeClose();
      await this.client.close();
      this.closed = true;
    });
  }
}

class LocalCanonicalCommandRepository implements CanonicalCommandRepository {
  private uncertainty: CanonicalUncertaintyDescriptor | undefined;
  private uncertaintyRecorded = false;
  private preparedUncertainty: PreparedCanonicalUncertainty | undefined;
  constructor(
    private readonly input: CanonicalRepositoryActivationInput & {
      writerGeneration: WriterGeneration;
    },
    private readonly owner: CanonicalTransactionOwner,
    private readonly sha256Text: (text: string) => Promise<string>,
    private readonly settlement: CanonicalCommandRepositoryFactoryDependencies,
  ) {}
  get projectId(): ProjectId {
    return this.input.projectId;
  }
  get writerGeneration(): WriterGeneration {
    return this.input.writerGeneration;
  }

  async settle(commandText: string): Promise<CanonicalCommandSettlementResult> {
    if (this.uncertainty !== undefined)
      throw new Error("Canonical Writer requires uncertainty recovery.");
    const command = readCanonicalCommandSnapshot(commandText);
    if (command.projectId !== this.projectId)
      throw new Error("Settlement Project does not match its repository.");
    if (this.owner.hasUnfinishedTransaction)
      throw new Error("Canonical Writer transaction is already owned.");
    return this.owner.exclusively(() => this.settleOwned(command));
  }

  private async settleOwned(
    command: CanonicalCommandSnapshot,
  ): Promise<CanonicalCommandSettlementResult> {
    const digest = decodeStrict(digestSchema, await this.sha256Text(this.input.writerToken));
    const fingerprint = hashCanonicalJson(command);
    const outcome = await runClassifiedWriteTransaction<
      LocalLibsqlTransaction,
      CanonicalCommandSettlementResult
    >(this.owner, async (tx) => {
      if (!(await currentSettlementFence(tx, this.projectId, this.writerGeneration, digest)))
        return { status: "stale-writer" };
      return settleFirstCanonicalCommand({
        transaction: tx,
        command,
        fingerprint,
        writerGeneration: this.writerGeneration,
        dependencies: this.settlement,
      });
    });
    if (outcome.status === "succeeded") return outcome.result;
    if (outcome.commit === "uncertain")
      this.uncertainty = Object.freeze({ commandId: command.commandId, fingerprint });
    throw outcome.error;
  }

  async verifyFence(): Promise<WriterFenceCheck> {
    try {
      const digest = decodeStrict(digestSchema, await this.sha256Text(this.input.writerToken));
      const rows = await readFenceRows(this.owner.client, this.projectId);
      if (rows.length === 0) return { status: "stale" };
      const row = one(rows);
      const current = [
        row.generation === this.writerGeneration,
        row.generationNumber === this.writerGeneration,
        row.tokenDigest === digest,
        row.generationDigest === digest,
        row.state === "active",
        row.releasedAt === null,
        row.generationReleasedAt === null,
      ].every(Boolean);
      return current ? { status: "current" } : { status: "stale" };
    } catch (cause) {
      throw new CanonicalCommandRepositoryError("WRITER_FENCE_CHECK_FAILED", { cause });
    }
  }

  async releaseFence(releasedAt: string): Promise<WriterFenceCheck> {
    try {
      return await this.owner.exclusively(async () => {
        const time = decodeStrict(utcInstantSchema, releasedAt);
        const digest = decodeStrict(digestSchema, await this.sha256Text(this.input.writerToken));
        if ((await this.recordUncertainty(digest)).status === "stale") return { status: "stale" };
        return await withWriteTransaction<LocalLibsqlTransaction, WriterFenceCheck>(
          this.owner,
          async (tx) => {
            const fence = await tx.execute({
              sql: "UPDATE writer_fence SET state='released', released_at=? WHERE project_id=? AND writer_generation=? AND token_digest=? AND state='active' AND released_at IS NULL",
              args: [time, this.projectId, this.writerGeneration, digest],
            });
            if (fence.rowsAffected === 0) return { status: "stale" };
            changedOnce(fence);
            changedOnce(
              await tx.execute({
                sql: "UPDATE writer_generations SET released_at=? WHERE project_id=? AND writer_generation=? AND token_digest=? AND released_at IS NULL",
                args: [time, this.projectId, this.writerGeneration, digest],
              }),
            );
            return { status: "current" };
          },
        );
      });
    } catch (cause) {
      throw new CanonicalCommandRepositoryError("WRITER_FENCE_RELEASE_FAILED", { cause });
    }
  }

  async close(): Promise<void> {
    try {
      await this.owner.close(async () => {
        if (this.uncertainty === undefined || this.uncertaintyRecorded) return;
        const digest = decodeStrict(digestSchema, await this.sha256Text(this.input.writerToken));
        if ((await this.recordUncertainty(digest)).status === "stale")
          throw new Error("Canonical Writer uncertainty authority is stale.");
      });
    } catch (cause) {
      throw new CanonicalCommandRepositoryError("WRITER_REPOSITORY_CLOSE_FAILED", { cause });
    }
  }

  private async recordUncertainty(digest: string): Promise<WriterFenceCheck> {
    if (this.uncertainty === undefined || this.uncertaintyRecorded) return { status: "current" };
    this.preparedUncertainty ??= prepareCanonicalUncertainty(
      {
        ...this.uncertainty,
        projectId: this.projectId,
        writerGeneration: this.writerGeneration,
      },
      this.settlement,
    );
    const record = this.preparedUncertainty;
    const result = await withWriteTransaction(this.owner, (tx) =>
      recordCanonicalUncertainty(tx, record, digest),
    );
    if (result.status === "current") this.uncertaintyRecorded = true;
    return result.status === "current" ? { status: "current" } : { status: "stale" };
  }
}

async function failedActivation(
  cause: unknown,
  client: CanonicalTransactionOwner | undefined,
): Promise<CanonicalCommandRepositoryActivationResult> {
  if (client !== undefined) {
    if (client.hasUnfinishedTransaction) {
      return {
        status: "broken",
        cleanup: { close: () => client.close() },
        error: new CanonicalCommandRepositoryError("WRITER_REPOSITORY_CLOSE_FAILED", { cause }),
      };
    }
    try {
      await client.close();
    } catch (closeError) {
      return {
        status: "broken",
        cleanup: { close: () => client.close() },
        error: new CanonicalCommandRepositoryError("WRITER_REPOSITORY_CLOSE_FAILED", {
          cause: new AggregateError(
            [cause, closeError],
            "Canonical Writer activation and repository close failed.",
          ),
        }),
      };
    }
  }
  return {
    status: "broken",
    error: new CanonicalCommandRepositoryError("WRITER_FENCE_ACTIVATION_FAILED", { cause }),
  };
}

export function createCanonicalCommandRepositoryFactory(
  dependencies: CanonicalCommandRepositoryFactoryDependencies,
): CanonicalCommandRepositoryFactory {
  return {
    activate: async (input) => {
      let client: CanonicalTransactionOwner | undefined;
      try {
        const owner = new CanonicalTransactionOwner(
          configuredClient(dependencies.openClient(input.canonicalDatabasePath)),
        );
        client = owner;
        const writerToken = decodeStrict(WriterCapabilityTokenSchema, input.writerToken);
        const activatedAt = decodeStrict(utcInstantSchema, input.activatedAt);
        const digest = decodeStrict(digestSchema, await dependencies.sha256Text(writerToken));
        const validated = { ...input, writerToken, activatedAt };
        const writerGeneration = await owner.exclusively(() =>
          withWriteTransaction(owner, (tx) =>
            activateFence({ tx, input: validated, digest, dependencies }),
          ),
        );
        return {
          status: "activated",
          writerGeneration,
          repository: new LocalCanonicalCommandRepository(
            { ...validated, writerGeneration },
            client,
            dependencies.sha256Text,
            dependencies,
          ),
        };
      } catch (cause) {
        return failedActivation(cause, client);
      }
    },
  };
}
