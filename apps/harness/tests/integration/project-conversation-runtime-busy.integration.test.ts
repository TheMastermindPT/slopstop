import { randomUUID } from "node:crypto";
import { projectConversationDiagnostics as rows } from "@slopstop/protocol";
import { expect, it } from "vitest";
import { sharedReader } from "./conversation-fence-fixture.js";
import { exclusiveLock, readOnlyClientOpenHooks, timed } from "./conversation-writer-fixture.js";
import {
  closeAdmission,
  closureKinds,
  expectSourceReleased,
} from "./project-conversation-closure-fixture.js";
import {
  activeTarget,
  type ConversationProcessRuntime,
  runThenCleanUp,
  startComposedConversationRuntime,
  startConversationProcessRuntime,
} from "./project-conversation-runtime-fixture.js";
import {
  createRequest,
  createTemporaryApplicationRoot,
} from "./project-storage-runtime-fixture.js";
import { createCurrentProject } from "./project-storage-upgrade-recovery-fixture.js";

const projectId = createRequest.projectId;

/** A schema-4 Project on a fresh root, a runtime over it, and its read-write target. */
async function inRuntime(
  start: (root: string) => ConversationProcessRuntime,
  body: (
    runtime: ConversationProcessRuntime,
    target: Readonly<{ projectId: string; activationId: string }>,
    root: string,
  ) => Promise<void>,
) {
  const root = await createTemporaryApplicationRoot();
  await createCurrentProject({ root });
  const runtime = start(root);
  await runThenCleanUp(async () => {
    const target = await activeTarget(runtime, projectId);
    await body(runtime, { projectId, activationId: target.activationId }, root);
  }, runtime.stop);
}

const message = () => ({ saveId: randomUUID(), expectedRevision: 0, text: "busy" });

// One design row (storage busy, real lock) as two tests: each busy wait takes about 7.4 s, and
// two in one test stack past the 15 s budget (#94).
it("maps storage busy through the harness for save (CNV-B13, real lock)", () =>
  inRuntime(startConversationProcessRuntime, async (runtime, target, root) => {
    const text = message();
    const lock = exclusiveLock(root);
    try {
      const saved = await timed("runtime save behind an exclusive lock", () =>
        runtime.save(target, text),
      );
      expect(saved.value.payload).toEqual({
        status: "unavailable",
        request: { ...target, ...text },
        diagnostic: rows.storageUnavailable,
      });
    } finally {
      lock.release();
    }
    expect(await runtime.save(target, text)).toMatchObject({ payload: { status: "saved" } });
  }));

it("maps storage busy through the harness for read (CNV-B13, real lock)", () =>
  inRuntime(startConversationProcessRuntime, async (runtime, target, root) => {
    const lock = exclusiveLock(root);
    try {
      const read = await timed("runtime read behind an exclusive lock", () => runtime.read(target));
      expect(read.value.payload).toEqual({
        status: "unavailable",
        request: { ...target, after: null },
        diagnostic: rows.storageUnavailable,
      });
    } finally {
      lock.release();
    }
    expect(await runtime.read(target)).toMatchObject({ payload: { status: "read" } });
  }));

it("maps an unconfirmed save to uncertain through the harness (CNV-B13, seam b)", () =>
  inRuntime(startComposedConversationRuntime, async (runtime, target, root) => {
    const reader = sharedReader(root);
    let lock: ReturnType<typeof exclusiveLock> | undefined;
    readOnlyClientOpenHooks.push(() => {
      reader.release();
      lock = exclusiveLock(root);
      return undefined;
    });
    const text = message();
    try {
      const saved = await timed("runtime save whose reconciliation cannot read", () =>
        runtime.save(target, text),
      );
      expect(saved.value.payload).toEqual({
        status: "uncertain",
        request: { ...target, ...text },
        diagnostic: rows.saveUnconfirmed,
      });
    } finally {
      lock?.release();
    }
  }));

it.each(closureKinds)(
  "answers unavailable for a read behind a held lock after a closure by %s (CNV-B13, seam b)",
  (kind) =>
    inRuntime(startComposedConversationRuntime, async (runtime, target, root) => {
      await closeAdmission(runtime, target, kind);
      const lock = exclusiveLock(root);
      try {
        const read = await timed(`read-only fallback read behind a held lock (${kind})`, () =>
          runtime.read(target),
        );
        expect(read.value.payload).toEqual({
          status: "unavailable",
          request: { ...target, after: null },
          diagnostic: rows.storageUnavailable,
        });
      } finally {
        lock.release();
      }
      await expectSourceReleased(runtime, target);
    }),
);
