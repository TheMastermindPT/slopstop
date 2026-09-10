import type { ProjectActivationId, ProjectId, WriterGeneration } from "@slopstop/protocol";
import {
  ProjectActivationIdSchema,
  ProjectIdSchema,
  WriterGenerationSchema,
} from "@slopstop/protocol";
import { z } from "zod";
import {
  canonicalChangedOnce as changedOnce,
  CanonicalSha256Schema as digestSchema,
  canonicalResultObjects as objects,
  canonicalExactlyOne as one,
  readCanonicalCommandSnapshot,
} from "../canonical-json.js";
import type {
  CanonicalCommandSettlementResult,
  CanonicalSettlementDependencies,
} from "./canonical-command-settlement.js";
import { settleFirstCanonicalCommand } from "./canonical-command-settlement.js";
import type { LocalLibsqlClient, LocalLibsqlTransaction } from "./local-libsql-worker-client.js";
import { withWriteTransaction } from "./project-storage-transaction.js";

export const WriterCapabilityTokenSchema = digestSchema.brand<"WriterCapabilityToken">();
export type WriterCapabilityToken = z.infer<typeof WriterCapabilityTokenSchema>;
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
export type CanonicalRepositoryActivationInput = Readonly<{
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

const utcInstantSchema = z.iso
  .datetime({ offset: true })
  .refine((value) => /T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u.test(value));
const identitySchema = z.uuid().refine((value) => value === value.toLowerCase());
const summarySchema = z.strictObject({
  last: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  count: z.number().int().nonnegative(),
  maximum: WriterGenerationSchema.nullable(),
});
const fenceSchema = z.strictObject({
  generation: WriterGenerationSchema,
  tokenDigest: digestSchema,
  state: z.enum(["active", "released"]),
  activatedAt: utcInstantSchema,
  releasedAt: utcInstantSchema.nullable(),
  generationNumber: WriterGenerationSchema.nullable(),
  generationDigest: digestSchema.nullable(),
  generationAcquiredAt: utcInstantSchema.nullable(),
  generationReleasedAt: utcInstantSchema.nullable(),
});
type PriorFence = z.infer<typeof fenceSchema>;
const settlementFenceSchema = fenceSchema.extend({
  projectId: ProjectIdSchema,
  generationProjectId: ProjectIdSchema,
  generationActivationId: ProjectActivationIdSchema,
  generationNumber: WriterGenerationSchema,
  generationDigest: digestSchema,
  generationAcquiredAt: utcInstantSchema,
});

function normalizedUtc(value: string): string {
  const [seconds, fraction = ""] = utcInstantSchema.parse(value).slice(0, -1).split(".");
  return `${seconds}.${fraction.replace(/0+$/u, "")}`;
}
function coherentRelease(fence: PriorFence): boolean {
  if (fence.state === "active")
    return fence.releasedAt === null && fence.generationReleasedAt === null;
  if (fence.releasedAt === null || fence.generationReleasedAt === null) return false;
  return normalizedUtc(fence.releasedAt) === normalizedUtc(fence.generationReleasedAt);
}

function configuredClient(client: LocalLibsqlClient): LocalLibsqlClient {
  return {
    execute: (statement, args) => client.execute(statement, args),
    close: () => client.close(),
    transaction: async (mode) => {
      await client.execute("PRAGMA foreign_keys = ON");
      await client.execute("PRAGMA busy_timeout = 5000");
      one(
        z
          .strictObject({ foreign_keys: z.literal(1) })
          .array()
          .parse(objects(await client.execute("PRAGMA foreign_keys"))),
      );
      return client.transaction(mode);
    },
  };
}

async function readFenceRows(
  executor: Pick<LocalLibsqlClient, "execute">,
  projectId: ProjectId,
): Promise<PriorFence[]> {
  return fenceSchema.array().parse(
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

async function currentSettlementFence(
  tx: LocalLibsqlTransaction,
  projectId: ProjectId,
  generation: WriterGeneration,
  digest: string,
): Promise<boolean> {
  const rows = settlementFenceSchema.array().parse(
    objects(
      await tx.execute({
        sql: `SELECT f.project_id AS projectId, f.writer_generation AS generation,
      f.token_digest AS tokenDigest, f.state, f.activated_at AS activatedAt, f.released_at AS releasedAt,
      g.project_id AS generationProjectId, g.activation_id AS generationActivationId,
      g.writer_generation AS generationNumber, g.token_digest AS generationDigest,
      g.acquired_at AS generationAcquiredAt, g.released_at AS generationReleasedAt
      FROM writer_fence AS f LEFT JOIN writer_generations AS g
      ON g.project_id=f.project_id AND g.writer_generation=f.writer_generation WHERE f.project_id=?`,
        args: [projectId],
      }),
    ),
  );
  if (rows.length === 0) return false;
  const fence = one(rows);
  const coherent = [
    fence.projectId === projectId,
    fence.generationProjectId === projectId,
    fence.generation === fence.generationNumber,
    fence.tokenDigest === fence.generationDigest,
    normalizedUtc(fence.activatedAt) === normalizedUtc(fence.generationAcquiredAt),
    coherentRelease(fence),
  ].every(Boolean);
  if (!coherent) throw new Error("Canonical settlement fence authority is inconsistent.");
  return (
    fence.state === "active" && fence.generation === generation && fence.tokenDigest === digest
  );
}

async function priorFence(
  tx: LocalLibsqlTransaction,
  projectId: ProjectId,
): Promise<PriorFence | undefined> {
  const summary = one(
    summarySchema.array().parse(
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
  return fence;
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
): Promise<void> {
  const { tx, input, dependencies } = context;
  const kind =
    previous === undefined ? "initial" : previous.state === "active" ? "recovery" : "clean";
  changedOnce(
    await tx.execute({
      sql: "INSERT INTO writer_handoffs (project_id,handoff_id,from_writer_generation,to_writer_generation,kind,recorded_at) VALUES (?,?,?,?,?,?)",
      args: [
        input.projectId,
        identitySchema.parse(dependencies.createHandoffId()),
        previous?.generation ?? null,
        generation,
        kind,
        input.activatedAt,
      ],
    }),
  );
}

async function recordAbandonment(
  context: ActivationTransaction,
  generation: WriterGeneration,
  previous: PriorFence,
): Promise<void> {
  const { tx, input, dependencies } = context;
  changedOnce(
    await tx.execute({
      sql: "UPDATE writer_generations SET released_at=? WHERE project_id=? AND writer_generation=? AND token_digest=? AND released_at IS NULL",
      args: [input.activatedAt, input.projectId, previous.generation, previous.tokenDigest],
    }),
  );
  changedOnce(
    await tx.execute({
      sql: `INSERT INTO writer_recovery_records (project_id,recovery_record_id,writer_generation,reason,command_id,command_fingerprint,observed_at,resolution,resolved_by_writer_generation,resolved_at)
      VALUES (?,?,?,'abandoned-active-fence',NULL,NULL,?,'generation-superseded',?,?)`,
      args: [
        input.projectId,
        identitySchema.parse(dependencies.createRecoveryRecordId()),
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
  const last = previous?.generation ?? 0;
  const generation = WriterGenerationSchema.parse(last + 1);
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
  if (previous?.state === "active") await recordAbandonment(context, generation, previous);
  await recordHandoff(context, generation, previous);
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

  async close(): Promise<void> {
    await this.exclusively(async () => {
      if (this.closed) return;
      await this.client.close();
      this.closed = true;
    });
  }
}

class LocalCanonicalCommandRepository implements CanonicalCommandRepository {
  constructor(
    private readonly input: CanonicalRepositoryActivationInput & {
      writerGeneration: WriterGeneration;
    },
    private readonly owner: CanonicalTransactionOwner,
    private readonly sha256Text: (text: string) => Promise<string>,
    private readonly settlement: CanonicalSettlementDependencies,
  ) {}
  get projectId(): ProjectId {
    return this.input.projectId;
  }
  get writerGeneration(): WriterGeneration {
    return this.input.writerGeneration;
  }

  async settle(commandText: string): Promise<CanonicalCommandSettlementResult> {
    const command = readCanonicalCommandSnapshot(commandText);
    if (command.projectId !== this.projectId)
      throw new Error("Settlement Project does not match its repository.");
    if (this.owner.hasUnfinishedTransaction)
      throw new Error("Canonical Writer transaction is already owned.");
    return this.owner.exclusively(async () => {
      const digest = digestSchema.parse(await this.sha256Text(this.input.writerToken));
      return withWriteTransaction<LocalLibsqlTransaction, CanonicalCommandSettlementResult>(
        this.owner,
        async (tx) => {
          if (!(await currentSettlementFence(tx, this.projectId, this.writerGeneration, digest)))
            return { status: "stale-writer" };
          return settleFirstCanonicalCommand({
            transaction: tx,
            command,
            writerGeneration: this.writerGeneration,
            dependencies: this.settlement,
          });
        },
      );
    });
  }

  async verifyFence(): Promise<WriterFenceCheck> {
    try {
      const digest = digestSchema.parse(await this.sha256Text(this.input.writerToken));
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
        const time = utcInstantSchema.parse(releasedAt);
        const digest = digestSchema.parse(await this.sha256Text(this.input.writerToken));
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
      await this.owner.close();
    } catch (cause) {
      throw new CanonicalCommandRepositoryError("WRITER_REPOSITORY_CLOSE_FAILED", { cause });
    }
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
        const writerToken = WriterCapabilityTokenSchema.parse(input.writerToken);
        const activatedAt = utcInstantSchema.parse(input.activatedAt);
        const digest = digestSchema.parse(await dependencies.sha256Text(writerToken));
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
