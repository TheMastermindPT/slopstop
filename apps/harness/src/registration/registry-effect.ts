import { Data, Effect, Result } from "effect";
import type { LocalLibsqlTransaction } from "../storage/local-libsql-worker-client.js";
import { withWriteTransaction } from "../storage/project-storage-transaction.js";
import { type RegistrationDatabaseOptions, withRegistrationDatabase } from "./registry-database.js";
import { RegistryFault, registryFailure } from "./registry-failure.js";

/** A registry read refused or failed; `failure` is the registry's own result envelope. */
export class RegistryReadFailed extends Data.TaggedError("RegistryReadFailed")<{
  readonly failure: ReturnType<typeof registryFailure>;
}> {}

/**
 * What a Promise facade rejects with for a failed registry read, so `registryFailure` gives the
 * read's own answer: a registry failure as its `RegistryFault`, an internal failure as is.
 */
export function registryReadRejection(
  failed: RegistryReadFailed,
): RegistryFault | RegistryReadFailed {
  const { failure } = failed;
  return failure.code === "INTERNAL_FAILURE" ? failed : new RegistryFault(failure);
}

/** One registry statement group, run inside the caller's transaction. */
export function registryRead<Value>(
  transaction: LocalLibsqlTransaction,
  read: (transaction: LocalLibsqlTransaction) => Promise<Value>,
): Effect.Effect<Value, RegistryReadFailed> {
  return Effect.tryPromise({
    try: () => read(transaction),
    catch: (cause) => new RegistryReadFailed({ failure: registryFailure(cause) }),
  });
}

/**
 * Runs a registry program in one transaction on an existing application database. The
 * worker client and its transaction stay behind the application database authority's
 * Promise facade; the program's typed failure crosses it as a value.
 */
export function withRegistryTransaction<Value>(
  options: RegistrationDatabaseOptions,
  program: (transaction: LocalLibsqlTransaction) => Effect.Effect<Value, RegistryReadFailed>,
): Effect.Effect<Value, RegistryReadFailed> {
  return Effect.tryPromise({
    try: () =>
      withRegistrationDatabase(
        options,
        (client) =>
          withWriteTransaction(client, (transaction) =>
            Effect.runPromise(Effect.result(program(transaction))),
          ),
        "existing-only",
      ),
    catch: (cause) => new RegistryReadFailed({ failure: registryFailure(cause) }),
  }).pipe(
    Effect.flatMap((outcome) =>
      Result.isSuccess(outcome) ? Effect.succeed(outcome.success) : Effect.fail(outcome.failure),
    ),
  );
}
