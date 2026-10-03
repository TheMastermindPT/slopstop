import { decodeStrict } from "@slopstop/protocol";
import { describe, expect, it, vi } from "vitest";
import {
  createProjectRegistrationObserver,
  type GitVersionInspectionRequest,
  GitVersionInspectionRequestSchema,
  type GitVersionInspectionResult,
  GitVersionInspectionResultSchema,
  type ObserverAdmissionPort,
} from "./project-registration-observer.js";
import {
  type ExecutableIdentityObservation,
  ExecutableIdentitySchema,
} from "./registration/executable-identity.js";
import { createGitVersionInspection } from "./registration/git-version-inspection.js";
import {
  createVersionObservationExecution,
  type GitVersionChildPort,
  type VersionDispatch,
} from "./registration/version-observation-execution.js";

const openAdmission: ObserverAdmissionPort = { hasUnsettled: async () => false };

const executableIdentity = decodeStrict(ExecutableIdentitySchema, {
  platform: "win32",
  volumeIdentity: "3240924279274158738",
  fileIdentity: "51509920738823581",
  birthIdentity: "1785884984567512900",
  sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
});

function createVersionScenario(
  inspectIdentity: () => Promise<ExecutableIdentityObservation> = async () => ({
    status: "observed",
    identity: executableIdentity,
  }),
  afterDispatch: () => void = () => undefined,
  childResult: Awaited<ReturnType<GitVersionChildPort["run"]>> = {
    status: "exited",
    exitCode: 0,
    stdout: new TextEncoder().encode("git version 2.53.0.windows.1\r\n"),
    stderr: new Uint8Array(),
  },
  admission: ObserverAdmissionPort = openAdmission,
) {
  const request = decodeStrict(GitVersionInspectionRequestSchema, {
    selectionId: "a728db30-50c9-4aef-a5d6-9a70536314fe",
    consentId: "fefb33aa-d12b-424a-b87a-6f757cd029a3",
  });
  const prepared = decodeStrict(GitVersionInspectionResultSchema, {
    status: "prepared",
    selectionId: request.selectionId,
    observationId: "c42caec7-06c4-49bd-9a34-e5b034ab2477",
    version: "2.53.0.windows.1",
  });
  if (prepared.status !== "prepared") throw new Error("Invalid test observation");
  const durableEvents: string[] = [];
  const declaredDispatches: VersionDispatch[] = [];
  const observedArgv: string[][] = [];
  const execution = createVersionObservationExecution({
    inspectIdentity,
    journal: {
      readResult: async () => undefined,
      begin: async (dispatch) => {
        declaredDispatches.push(dispatch);
        durableEvents.push("dispatch-intent");
        return { status: "started", observationId: prepared.observationId };
      },
      complete: async () => {
        durableEvents.push("version-validated");
      },
      recordChild: async () => undefined,
      recordNoDispatch: async () => undefined,
      cancel: async () => undefined,
      recordTerminal: async () => undefined,
      invalidate: async () => {
        durableEvents.push("version-invalidated");
      },
    },
    child: {
      run: async (dispatch) => {
        observedArgv.push([...dispatch.argv]);
        durableEvents.push("child-dispatched");
        afterDispatch();
        return childResult;
      },
    },
  });
  const observer = createProjectRegistrationObserver(
    createGitVersionInspection(
      {
        resolve: async () => ({
          status: "accepted",
          executablePath: "C:\\Program Files\\Git\\cmd\\git.exe",
          executableIdentity,
        }),
      },
      execution,
    ),
    admission,
  );
  return { request, prepared, observer, durableEvents, declaredDispatches, observedArgv };
}

describe("Project registration observer executable admission", () => {
  it.each(["registry", "consent"] as const)(
    "closes dispatch while %s admission is pending",
    async (stage) => {
      let release: () => void = () => undefined;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      const admittedExecutables: string[] = [];
      const observer = createProjectRegistrationObserver(
        createGitVersionInspection(
          {
            resolve: async () => {
              if (stage === "consent") await held;
              return {
                status: "accepted",
                executablePath: "C:\\Program Files\\Git\\cmd\\git.exe",
                executableIdentity,
              };
            },
          },
          {
            inspect: async (request) => {
              admittedExecutables.push(request.executablePath);
              return { status: "unavailable", code: "GIT_UNAVAILABLE" };
            },
          },
        ),
        {
          hasUnsettled: async () => {
            if (stage === "registry") await held;
            return false;
          },
        },
      );
      const request = decodeStrict(GitVersionInspectionRequestSchema, {
        selectionId: "a728db30-50c9-4aef-a5d6-9a70536314fe",
        consentId: "fefb33aa-d12b-424a-b87a-6f757cd029a3",
      });
      const observation = observer.inspectGitVersion(request);
      await Promise.resolve();
      const closing = observer.close();
      release();
      expect(await observation).toEqual({ status: "cancelled" });
      expect(await closing).toEqual({ status: "closed" });
      expect(admittedExecutables).toEqual([]);
    },
  );

  it("closes by the cleanup deadline and refuses a late successful observation", async () => {
    vi.useFakeTimers();
    let finish: (result: GitVersionInspectionResult) => void = () => undefined;
    const held = new Promise<GitVersionInspectionResult>((resolve) => {
      finish = resolve;
    });
    const observer = createProjectRegistrationObserver(
      { inspect: async () => held },
      openAdmission,
    );
    const request = decodeStrict(GitVersionInspectionRequestSchema, {
      selectionId: "a728db30-50c9-4aef-a5d6-9a70536314fe",
      consentId: "fefb33aa-d12b-424a-b87a-6f757cd029a3",
    });
    const prepared = decodeStrict(GitVersionInspectionResultSchema, {
      status: "prepared",
      selectionId: request.selectionId,
      observationId: "c42caec7-06c4-49bd-9a34-e5b034ab2477",
      version: "2.53.0.windows.1",
    });
    const observation = observer.inspectGitVersion(request);
    await vi.advanceTimersByTimeAsync(0);
    let result: unknown;
    const closing = observer.close().then((value) => {
      result = value;
    });
    try {
      await vi.advanceTimersByTimeAsync(4999);
      expect(result).toBeUndefined();
      await vi.advanceTimersByTimeAsync(1);
      expect(result).toEqual({ status: "pending-recovery", code: "OBSERVER_CLEANUP_UNCONFIRMED" });
      finish(prepared);
      expect(await observation).toEqual({
        status: "pending-recovery",
        code: "OBSERVER_CLEANUP_UNCONFIRMED",
      });
      expect(await observer.inspectGitVersion(request)).toEqual({ status: "cancelled" });
    } finally {
      finish(prepared);
      await observation;
      await closing;
      vi.useRealTimers();
    }
  });

  it("requires stage-one consent before inspecting an executable version", async () => {
    const admittedInspections: GitVersionInspectionRequest[] = [];
    const observer = createProjectRegistrationObserver(
      {
        inspect: async (request) => {
          admittedInspections.push(request);
          return { status: "unavailable", code: "GIT_UNAVAILABLE" };
        },
      },
      openAdmission,
    );

    const result = await observer.inspectGitVersion(
      decodeStrict(GitVersionInspectionRequestSchema, {
        selectionId: "a728db30-50c9-4aef-a5d6-9a70536314fe",
        consentId: null,
      }),
    );

    expect(result).toEqual({ status: "unavailable", code: "GIT_CONFIRMATION_REQUIRED" });
    expect(admittedInspections).toEqual([]);
  });

  it("refuses an unknown stage-one decision without dispatching a version child", async () => {
    const dispatchedExecutables: string[] = [];
    const observer = createProjectRegistrationObserver(
      createGitVersionInspection(
        { resolve: async () => ({ status: "unconfirmed" }) },
        {
          inspect: async (request) => {
            dispatchedExecutables.push(request.executablePath);
            return { status: "unavailable", code: "GIT_UNAVAILABLE" };
          },
        },
      ),
      openAdmission,
    );

    const result = await observer.inspectGitVersion(
      decodeStrict(GitVersionInspectionRequestSchema, {
        selectionId: "a728db30-50c9-4aef-a5d6-9a70536314fe",
        consentId: "fefb33aa-d12b-424a-b87a-6f757cd029a3",
      }),
    );

    expect(result).toEqual({ status: "unavailable", code: "GIT_CONFIRMATION_REQUIRED" });
    expect(dispatchedExecutables).toEqual([]);
  });

  it("returns the version observation admitted by the stored stage-one decision", async () => {
    const request = decodeStrict(GitVersionInspectionRequestSchema, {
      selectionId: "a728db30-50c9-4aef-a5d6-9a70536314fe",
      consentId: "fefb33aa-d12b-424a-b87a-6f757cd029a3",
    });
    const observation = decodeStrict(GitVersionInspectionResultSchema, {
      status: "prepared",
      selectionId: request.selectionId,
      observationId: "c42caec7-06c4-49bd-9a34-e5b034ab2477",
      version: "2.53.0.windows.1",
    });
    const inspectedExecutables: string[] = [];
    const observer = createProjectRegistrationObserver(
      createGitVersionInspection(
        {
          resolve: async () => ({
            status: "accepted",
            executablePath: "C:\\Program Files\\Git\\cmd\\git.exe",
            executableIdentity,
          }),
        },
        {
          inspect: async (admitted) => {
            inspectedExecutables.push(admitted.executablePath);
            return observation;
          },
        },
      ),
      openAdmission,
    );

    expect(await observer.inspectGitVersion(request)).toEqual(observation);
    expect(inspectedExecutables).toEqual(["C:\\Program Files\\Git\\cmd\\git.exe"]);
  });

  it("records a complete version inspection before returning its prepared observation", async () => {
    const scenario = createVersionScenario();
    expect(await scenario.observer.inspectGitVersion(scenario.request)).toEqual(scenario.prepared);
    expect(scenario.durableEvents).toEqual([
      "dispatch-intent",
      "child-dispatched",
      "version-validated",
    ]);
    expect(scenario.observedArgv).toEqual([["--version"]]);
    expect(scenario.declaredDispatches).toEqual([
      {
        ...scenario.request,
        executablePath: "C:\\Program Files\\Git\\cmd\\git.exe",
        executableIdentity,
      },
    ]);
  });

  it("requires renewed stage-one consent when the executable is replaced before dispatch", async () => {
    const scenario = createVersionScenario(async () => ({
      status: "observed",
      identity: { ...executableIdentity, fileIdentity: "51509920738823582" },
    }));

    expect(await scenario.observer.inspectGitVersion(scenario.request)).toEqual({
      status: "unavailable",
      code: "GIT_CONFIRMATION_REQUIRED",
    });
    expect(scenario.observedArgv).toEqual([]);
    expect(scenario.durableEvents).toEqual([]);
  });

  it("invalidates a version result when executable identity changes during dispatch", async () => {
    let current = executableIdentity;
    const scenario = createVersionScenario(
      async () => ({ status: "observed", identity: current }),
      () => {
        current = { ...executableIdentity, fileIdentity: "51509920738823582" };
      },
    );

    expect(await scenario.observer.inspectGitVersion(scenario.request)).toEqual({
      status: "unavailable",
      code: "GIT_CONFIRMATION_REQUIRED",
    });
    expect(scenario.observedArgv).toEqual([["--version"]]);
    expect(scenario.durableEvents).toEqual([
      "dispatch-intent",
      "child-dispatched",
      "version-invalidated",
    ]);
  });

  it("refuses a nonzero version child without publishing its successful-looking stdout", async () => {
    const scenario = createVersionScenario(undefined, undefined, {
      status: "exited",
      exitCode: 23,
      stdout: new TextEncoder().encode("git version 2.53.0.windows.1\n"),
      stderr: new TextEncoder().encode("private-config-canary"),
    });

    expect(await scenario.observer.inspectGitVersion(scenario.request)).toEqual({
      status: "unavailable",
      code: "GIT_QUERY_FAILED",
      exitCode: 23,
    });
    expect(scenario.durableEvents).not.toContain("version-validated");
  });

  it.each([
    { name: "invalid UTF-8", bytes: new Uint8Array([0xff, 0x0a]) },
    { name: "an extra line", bytes: new TextEncoder().encode("git version 2.53.0\nprivate\n") },
    { name: "embedded NUL", bytes: new TextEncoder().encode("git version 2.53.0\0\n") },
    { name: "a non-version value", bytes: new TextEncoder().encode("git version private\n") },
  ])("rejects a complete version result with $name", async ({ bytes }) => {
    const scenario = createVersionScenario(undefined, undefined, {
      status: "exited",
      exitCode: 0,
      stdout: bytes,
      stderr: new Uint8Array(),
    });

    expect(await scenario.observer.inspectGitVersion(scenario.request)).toEqual({
      status: "rejected",
      code: "OBSERVATION_INVALID",
    });
    expect(scenario.durableEvents).toEqual([
      "dispatch-intent",
      "child-dispatched",
      "version-invalidated",
    ]);
  });

  it.each(["stdout", "stderr"] as const)(
    "rejects %s overflow before parsing or exit classification",
    async (stream) => {
      const scenario = createVersionScenario(undefined, undefined, {
        status: "exited",
        exitCode: 23,
        stdout: new TextEncoder().encode("git version 2.53.0\n"),
        stderr: new Uint8Array(),
        [stream]: new Uint8Array(8193).fill(0xff),
      });

      expect(await scenario.observer.inspectGitVersion(scenario.request)).toEqual({
        status: "unavailable",
        code: "OBSERVATION_LIMIT_EXCEEDED",
      });
      expect(scenario.durableEvents).not.toContain("version-validated");
    },
  );

  it("reports an unexpected observer failure without disclosing its diagnostic", async () => {
    const scenario = createVersionScenario(async () => {
      throw new Error("private-config-canary C:\\private\\configuration");
    });

    expect(await scenario.observer.inspectGitVersion(scenario.request)).toEqual({
      status: "broken",
      code: "INTERNAL_FAILURE",
    });
    expect(scenario.observedArgv).toEqual([]);
  });

  it.each([
    { phase: "before", initiallyUnavailable: true, argv: [], events: [] },
    {
      phase: "after",
      initiallyUnavailable: false,
      argv: [["--version"]],
      events: ["dispatch-intent", "child-dispatched", "version-invalidated"],
    },
  ])("preserves identity capability failure $phase version dispatch", async (example) => {
    let unavailable = example.initiallyUnavailable;
    const scenario = createVersionScenario(
      async () =>
        unavailable
          ? { status: "unavailable", code: "IDENTITY_CAPABILITY_UNAVAILABLE" }
          : { status: "observed", identity: executableIdentity },
      () => {
        unavailable = true;
      },
    );

    expect(await scenario.observer.inspectGitVersion(scenario.request)).toEqual({
      status: "unavailable",
      code: "IDENTITY_CAPABILITY_UNAVAILABLE",
    });
    expect(scenario.observedArgv).toEqual(example.argv);
    expect(scenario.durableEvents).toEqual(example.events);
  });

  it("blocks observation until prior child ownership is settled", async () => {
    const scenario = createVersionScenario(undefined, undefined, undefined, {
      hasUnsettled: async () => true,
    });
    expect(
      await scenario.observer.inspectGitVersion({ ...scenario.request, consentId: null }),
    ).toEqual({
      status: "pending-recovery",
      code: "OBSERVER_CLEANUP_UNCONFIRMED",
    });
    expect(scenario.observedArgv).toEqual([]);
    expect(scenario.durableEvents).toEqual([]);
  });
});
