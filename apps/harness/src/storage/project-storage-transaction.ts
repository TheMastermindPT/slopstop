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

type TransactionOutcome<Result> =
  | Readonly<{ status: "succeeded"; result: Result }>
  | Readonly<{ status: "failed"; error: unknown }>;

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

async function executeTransaction<Transaction extends WriteTransaction, Result>(
  transaction: Transaction,
  operation: (transaction: Transaction) => Promise<Result>,
): Promise<TransactionOutcome<Result>> {
  try {
    const result = await operation(transaction);
    await transaction.commit();
    return { status: "succeeded", result };
  } catch (operationError) {
    try {
      return await rollbackAfterFailure(transaction, operationError);
    } catch (error) {
      return { status: "failed", error };
    }
  }
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

export async function withWriteTransaction<Transaction extends WriteTransaction, Result>(
  client: WriteTransactionClient<Transaction>,
  operation: (transaction: Transaction) => Promise<Result>,
): Promise<Result> {
  const transaction = await client.transaction("write");
  const outcome = await executeTransaction(transaction, operation);
  try {
    await transaction.close();
  } catch (closeError) {
    if (outcome.status === "failed") throw appendCloseFailure(outcome.error, closeError);
    throw closeError;
  }
  if (outcome.status === "failed") throw outcome.error;
  return outcome.result;
}
