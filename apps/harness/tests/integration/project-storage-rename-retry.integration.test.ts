import { randomUUID } from "node:crypto";
import { lstat, mkdir, rename as nodeRename, rm } from "node:fs/promises";
import path from "node:path";
import { Effect, Exit, Fiber, Latch } from "effect";
import { TestClock } from "effect/testing";
import { afterEach, expect, it } from "vitest";
import {
  ProjectStorageBrokenError,
  ProjectStorageUnavailableError,
} from "../../src/storage/project-storage-errors.js";
import {
  createProjectStorageFileAdapter,
  renameAtomicProgram,
} from "../../src/storage/project-storage-file-adapter.js";
import { temporaryRoot } from "./temporary-root.js";

const roots: string[] = [];

afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

/** A real `.staging-<id>` folder in a fresh root, and the `<id>` path it becomes. */
async function stagedGeneration() {
  const root = await temporaryRoot("rename-retry-");
  roots.push(root);
  const id = randomUUID();
  const source = path.join(root, `.staging-${id}`);
  await mkdir(source);
  return { root, source, destination: path.join(root, id) };
}

/**
 * A rename that, on attempt `n`, throws an error coded `held(n)` at once, or renames for real when
 * `held(n)` is undefined. It counts its calls, and `called` opens on the first one, so a row moves
 * the test clock only after the real precondition checks have run.
 */
function heldRename(held: (attempt: number) => string | undefined) {
  const called = Latch.makeUnsafe();
  let calls = 0;
  const rename = (from: string, to: string): Promise<void> => {
    calls += 1;
    called.openUnsafe();
    const code = held(calls);
    if (code !== undefined) throw Object.assign(new Error(`${code}: held`), { code });
    return nodeRename(from, to);
  };
  return { rename, calls: () => calls, called };
}

/** Runs a row's program under the test clock: no row sleeps for real. */
function underTestClock<A, E>(program: Effect.Effect<A, E>): Promise<A> {
  return Effect.runPromise(Effect.provide(program, TestClock.layer()));
}

async function isDirectory(entryPath: string): Promise<boolean> {
  return (await lstat(entryPath)).isDirectory();
}

it("makes the generation active after a short hold", async () => {
  const { source, destination } = await stagedGeneration();
  const fake = heldRename((attempt) => (attempt === 1 ? "EPERM" : undefined));
  await underTestClock(
    Effect.gen(function* () {
      const fiber = yield* Effect.forkChild(
        renameAtomicProgram({ source, destination, rename: fake.rename, platform: "win32" }),
      );
      yield* fake.called.await;
      yield* TestClock.adjust("50 millis");
      expect(Exit.isSuccess(yield* Fiber.await(fiber))).toBe(true);
    }),
  );
  expect(await isDirectory(destination)).toBe(true);
  await expect(lstat(source)).rejects.toMatchObject({ code: "ENOENT" });
  expect(fake.calls()).toBe(2);
});

it("answers unavailable after a lasting hold", async () => {
  const { source, destination } = await stagedGeneration();
  const fake = heldRename(() => "EBUSY");
  const failure = await underTestClock(
    Effect.gen(function* () {
      const fiber = yield* Effect.forkChild(
        Effect.flip(
          renameAtomicProgram({ source, destination, rename: fake.rename, platform: "win32" }),
        ),
      );
      yield* fake.called.await;
      yield* TestClock.adjust("450 millis");
      return yield* Fiber.join(fiber);
    }),
  );
  expect(failure).toBeInstanceOf(ProjectStorageUnavailableError);
  expect(failure.message).toBe("Project Storage authority is unavailable.");
  expect(fake.calls()).toBe(10);
  expect(await isDirectory(source)).toBe(true);
  await expect(lstat(destination)).rejects.toMatchObject({ code: "ENOENT" });
});

it("refuses an existing target without renaming", async () => {
  const { source, destination } = await stagedGeneration();
  await mkdir(destination);
  const fake = heldRename(() => undefined);
  const failure = await underTestClock(
    Effect.flip(
      renameAtomicProgram({ source, destination, rename: fake.rename, platform: "win32" }),
    ),
  );
  expect(failure).toBeInstanceOf(ProjectStorageBrokenError);
  expect(failure.message).toBe("Project Storage activation target already exists.");
  expect(fake.calls()).toBe(0);
});

it("rejects an existing target through the real adapter", async () => {
  const { root, source, destination } = await stagedGeneration();
  await mkdir(destination);
  const files = createProjectStorageFileAdapter({ applicationStorageRoot: root });
  const failure: unknown = await files.renameAtomic(source, destination).then(
    () => "resolved",
    (error: unknown) => error,
  );
  expect(failure).toBeInstanceOf(ProjectStorageBrokenError);
  expect(failure).toMatchObject({ message: "Project Storage activation target already exists." });
  expect(await isDirectory(source)).toBe(true);
  expect(await isDirectory(destination)).toBe(true);
});
