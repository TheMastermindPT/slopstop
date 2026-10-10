import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { rawCanonical } from "./conversation-writer-fixture.js";
import { generationPaths } from "./project-storage-open-fixture.js";

const newerToken = "d".repeat(64);

/**
 * Moves the writer fence to a newer generation with another token, coherently, as a newer
 * writer would. The returned restore moves it back, so the activation releases normally.
 */
export function moveWriterFence(root: string): () => void {
  let original: Record<string, unknown> = {};
  rawCanonical(root, (database) => {
    original =
      database.prepare("SELECT writer_generation, token_digest FROM writer_fence").get() ?? {};
    database
      .prepare(
        `INSERT INTO writer_generations (project_id, writer_generation, activation_id, token_digest,
          acquired_at, released_at)
        SELECT project_id, writer_generation + 1, ?, ?, activated_at, NULL FROM writer_fence`,
      )
      .run(randomUUID(), newerToken);
    database
      .prepare(
        "UPDATE writer_fence SET writer_generation = writer_generation + 1, token_digest = ?",
      )
      .run(newerToken);
  });
  return () =>
    rawCanonical(root, (database) => {
      database
        .prepare("UPDATE writer_fence SET writer_generation = ?, token_digest = ?")
        .run(Number(original["writer_generation"]), String(original["token_digest"]));
      database.prepare("DELETE FROM writer_generations WHERE token_digest = ?").run(newerToken);
    });
}

/** Another connection's open read transaction: its SHARED lock blocks a COMMIT. */
export function sharedReader(root: string) {
  const database = new DatabaseSync(generationPaths(root).canonical, { readOnly: true });
  database.exec("BEGIN");
  database.prepare("SELECT count(*) FROM conversations").get();
  return {
    release: () => {
      database.exec("COMMIT");
      database.close();
    },
  };
}
