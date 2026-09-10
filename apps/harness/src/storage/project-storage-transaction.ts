import { ProjectStorageBrokenError } from "./project-storage-errors.js";

type WriteTransaction = Readonly<{
  closed: boolean;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  close(): Promise<void> | void;
}>;

type WriteTransactionClient<Transaction extends WriteTransaction> = Readonly<{
  transaction(mode: "write"): Promise<Transaction>;
}>;

type WriteTransactionFailure = Readonly<{
  status: "failed";
  error: unknown;
  primaryError: unknown;
}> &
  (
    | Readonly<{ stage: "begin" | "body"; commit: "not-attempted" }>
    | Readonly<{ stage: "commit"; commit: "uncertain" }>
    | Readonly<{ stage: "close"; commit: "acknowledged" }>
  );

export type ClassifiedWriteTransactionOutcome<Result> =
  | Readonly<{ status: "succeeded"; stage: "closed"; commit: "acknowledged"; result: Result }>
  | WriteTransactionFailure;

type TransactionOutcome<Result> =
  | Readonly<{ status: "succeeded"; result: Result }>
  | WriteTransactionFailure;

async function rollbackAfterFailure(
  transaction: WriteTransaction,
  operationError: unknown,
): Promise<never> {
  if (transaction.closed) throw operationError;
  try {
    await transaction.rollback();
  } catch (rollbackError) {
    throw new ProjectStorageBrokenError("Project Storage transaction rollback failed.", {
      cause: new AggregateError(
        [operationError, rollbackError],
        "Project Storage transaction and rollback both failed.",
      ),
    });
  }
  throw operationError;
}

async function failedTransaction(
  transaction: WriteTransaction,
  primaryError: unknown,
  phase:
    | Readonly<{ stage: "body"; commit: "not-attempted" }>
    | Readonly<{ stage: "commit"; commit: "uncertain" }>,
): Promise<WriteTransactionFailure> {
  try {
    return await rollbackAfterFailure(transaction, primaryError);
  } catch (error) {
    return { status: "failed", ...phase, primaryError, error };
  }
}

async function executeTransaction<Transaction extends WriteTransaction, Result>(
  transaction: Transaction,
  operation: (transaction: Transaction) => Promise<Result>,
): Promise<TransactionOutcome<Result>> {
  let result: Result;
  try {
    result = await operation(transaction);
  } catch (primaryError) {
    return failedTransaction(transaction, primaryError, { stage: "body", commit: "not-attempted" });
  }
  try {
    await transaction.commit();
  } catch (primaryError) {
    return failedTransaction(transaction, primaryError, { stage: "commit", commit: "uncertain" });
  }
  return { status: "succeeded", result };
}

function appendCloseFailure(failure: unknown, closeError: unknown): unknown {
  if (!(failure instanceof ProjectStorageBrokenError)) {
    return new AggregateError(
      [failure, closeError],
      "Project Storage transaction and close both failed.",
    );
  }
  if (!(failure.cause instanceof AggregateError)) {
    return new ProjectStorageBrokenError(failure.message, {
      cause: new AggregateError(
        [failure, closeError],
        "Project Storage transaction and close both failed.",
      ),
    });
  }
  return new ProjectStorageBrokenError(failure.message, {
    cause: new AggregateError(
      [...failure.cause.errors, closeError],
      "Project Storage transaction, rollback, and close all failed.",
    ),
  });
}

async function runWriteTransaction<Transaction extends WriteTransaction, Result>(
  client: WriteTransactionClient<Transaction>,
  operation: (transaction: Transaction) => Promise<Result>,
): Promise<ClassifiedWriteTransactionOutcome<Result>> {
  let transaction: Transaction;
  try {
    transaction = await client.transaction("write");
  } catch (error) {
    return {
      status: "failed",
      stage: "begin",
      commit: "not-attempted",
      primaryError: error,
      error,
    };
  }
  const outcome = await executeTransaction(transaction, operation);
  try {
    await transaction.close();
  } catch (closeError) {
    if (outcome.status === "failed") {
      return { ...outcome, error: appendCloseFailure(outcome.error, closeError) };
    }
    return {
      status: "failed",
      stage: "close",
      commit: "acknowledged",
      primaryError: closeError,
      error: closeError,
    };
  }
  if (outcome.status === "failed") return outcome;
  return { status: "succeeded", stage: "closed", commit: "acknowledged", result: outcome.result };
}

export async function runClassifiedWriteTransaction<Transaction extends WriteTransaction, Result>(
  client: WriteTransactionClient<Transaction>,
  operation: (transaction: Transaction) => Promise<Result>,
): Promise<ClassifiedWriteTransactionOutcome<Result>> {
  return runWriteTransaction(client, operation);
}

export async function withWriteTransaction<Transaction extends WriteTransaction, Result>(
  client: WriteTransactionClient<Transaction>,
  operation: (transaction: Transaction) => Promise<Result>,
): Promise<Result> {
  const outcome = await runWriteTransaction(client, operation);
  if (outcome.status === "failed") throw outcome.error;
  return outcome.result;
}
