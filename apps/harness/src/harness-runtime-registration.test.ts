import { setImmediate as nextTurn } from "node:timers/promises";
import { createProjectRegistrationCommand } from "@slopstop/protocol";
import { Effect, Layer, ManagedRuntime } from "effect";
import { describe, expect, it, vi } from "vitest";
import { unusedCanonicalApplication as createUnusedCanonicalApplication } from "../tests/integration/canonical-runtime-application-fixture.js";
import { TestTransport } from "../tests/integration/harness-test-transport.js";
import {
  type RecordedRequestFailure,
  recordingRequestDiagnostics,
  silentRequestDiagnostics,
} from "../tests/integration/request-diagnostics-fixture.js";
import type { HarnessRequestDiagnostics } from "./harness-request-diagnostics.js";
import {
  createUnavailableProjectStorageApplication,
  createUnavailableWorkspaceApplication,
  startHarnessRuntime,
} from "./index.js";
import type { ProjectRegistrationFlow } from "./registration/project-registration-flow.js";

async function unexpectedCanonicalSwitch(): Promise<never> {
  throw new Error("Unexpected canonical Project switch in this fixture.");
}

function unusedCanonicalApplication() {
  return createUnusedCanonicalApplication(unexpectedCanonicalSwitch);
}

describe("registration requests on the process runtime", () => {
  const registrationRequest = createProjectRegistrationCommand(
    { messageId: "00000000-0000-4000-8000-000000000041", sentAt: "2026-10-18T12:00:00.000Z" },
    { step: "prepare-git" },
  );

  /** A process runtime over an empty Layer, built before the behaviour under test. */
  function builtProcessRuntime() {
    const runtime = ManagedRuntime.make(Layer.empty);
    runtime.runSync(Effect.void);
    return runtime;
  }

  function registrationRuntime(
    transport: TestTransport,
    handle: ProjectRegistrationFlow["handle"],
    runtime: ManagedRuntime.ManagedRuntime<never, never>,
    requestDiagnostics: HarnessRequestDiagnostics,
  ) {
    let generatedId = 2;
    return startHarnessRuntime({
      transport,
      requestDiagnostics,
      projectRegistration: { handle },
      runtime,
      canonicalProjectApplication: unusedCanonicalApplication(),
      projectStorageApplication:
        createUnavailableProjectStorageApplication(silentRequestDiagnostics),
      workspaceApplication: createUnavailableWorkspaceApplication(silentRequestDiagnostics),
      harnessVersion: "0.0.0",
      createId: () => `00000000-0000-4000-8000-${String(generatedId++).padStart(12, "0")}`,
      now: () => "2026-10-18T12:00:01.000Z",
    });
  }

  it("interrupts an in-flight registration request at dispose without a reply", async () => {
    const calls: string[] = [];
    const rejections: unknown[] = [];
    const onRejection = (reason: unknown) => rejections.push(reason);
    process.on("unhandledRejection", onRejection);
    try {
      const runtime = builtProcessRuntime();
      const transport = new TestTransport();
      const requests = recordingRequestDiagnostics();
      const stop = registrationRuntime(
        transport,
        () =>
          Effect.sync(() => calls.push("handle-started")).pipe(
            Effect.andThen(Effect.never),
            Effect.onInterrupt(() => Effect.sync(() => calls.push("handle-interrupted"))),
          ),
        runtime,
        requests.diagnostics,
      );
      transport.emit(registrationRequest);
      await vi.waitFor(() => expect(calls).toEqual(["handle-started"]));
      await stop();
      await runtime.dispose();
      expect(calls).toEqual(["handle-started", "handle-interrupted"]);
      expect(transport.sent).toEqual([]);
      await nextTurn();
      // A late reply to the interrupted request would arrive by now.
      expect(transport.sent).toEqual([]);
      expect(rejections).toEqual([]);
      expect(requests.calls).toEqual([]);
    } finally {
      process.off("unhandledRejection", onRejection);
    }
  });

  // `sequence: 1`: the one reply, with no registration result attempted before it.
  const internalFailure = {
    event: "request.failure",
    sequence: 1,
    causationId: registrationRequest.messageId,
    payload: {
      code: "HARNESS_INTERNAL_FAILURE",
      message: "Harness failed while handling a message.",
      retryable: false,
    },
  };

  const registrationDefect = new Error("private registration defect");

  it.each<{
    name: string;
    handle: ProjectRegistrationFlow["handle"];
    reply: unknown;
    expectRequests: (calls: readonly RecordedRequestFailure[]) => void;
  }>([
    {
      name: "handle succeeds",
      handle: () => Effect.succeed({ status: "trust-recorded" }),
      reply: {
        event: "project.registration.result",
        causationId: registrationRequest.messageId,
        payload: { status: "trust-recorded" },
      },
      expectRequests: (calls) => expect(calls).toEqual([]),
    },
    {
      name: "handle dies",
      handle: () => Effect.die(registrationDefect),
      reply: internalFailure,
      expectRequests: (calls) => {
        expect(calls).toHaveLength(1);
        expect(calls[0]?.boundary).toBe("harness.registration");
        expect(calls[0]?.failure).toBe(registrationDefect);
      },
    },
    {
      name: "handle interrupts itself before any stop",
      handle: () => Effect.interrupt,
      reply: internalFailure,
      expectRequests: (calls) => {
        expect(calls).toHaveLength(1);
        expect(calls[0]?.boundary).toBe("harness.registration");
        expect(calls[0]?.failure).toBeInstanceOf(Error);
        expect(calls[0]?.failure).toHaveProperty("message", "All fibers interrupted without error");
      },
    },
  ])(
    "answers registration exits on the process runtime: $name",
    async ({ handle, reply, expectRequests }) => {
      const runtime = builtProcessRuntime();
      const transport = new TestTransport();
      const requests = recordingRequestDiagnostics();
      const stop = registrationRuntime(transport, handle, runtime, requests.diagnostics);
      transport.emit(registrationRequest);
      await vi.waitFor(() => expect(transport.sent).toHaveLength(1));
      expect(transport.sent).toMatchObject([reply]);
      expectRequests(requests.calls);
      await stop();
      await runtime.dispose();
      expect(transport.sent).toHaveLength(1);
    },
  );
});
