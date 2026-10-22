import { isDeepStrictEqual } from "node:util";
import {
  createProjectCloseCommand,
  createProjectCreateCommand,
  createProjectOpenCommand,
  type DesktopMessage,
  decodeStrict,
  type HarnessMessage,
  type ProjectStorageCloseRequest,
  type ProjectStorageCloseResult,
  ProjectStorageCloseResultSchema,
  type ProjectStorageCreateRequest,
  type ProjectStorageCreateResult,
  ProjectStorageCreateResultSchema,
  type ProjectStorageOpenRequest,
  type ProjectStorageOpenResult,
  ProjectStorageOpenResultSchema,
} from "@slopstop/protocol";
import { Effect, Match, type Schema } from "effect";
import {
  answerRequest,
  bridgeNeutralText,
  type Clock,
  decodeReply,
  type HarnessRequestCore,
  makeHarnessRequestCore,
  type ProjectRequestFault,
} from "./harness-request-core.js";
import { harnessSendFailureMessage } from "./harness-send-failure.js";
import type { HarnessSessionClient } from "./harness-session.js";

type ProjectStorageBridgeOptions = Readonly<{
  session: HarnessSessionClient;
  createId(): string;
  now(): string;
}>;

const stoppedText = "Project Storage bridge is stopped.";

const desktopText = {
  "invalid-command": harnessSendFailureMessage({
    ok: false,
    error: { code: "HARNESS_SESSION_MESSAGE_INVALID" },
  }),
  ...bridgeNeutralText.desktop,
  "mismatched-event": "Harness returned a mismatched Project Storage response.",
  "mismatched-echo": "Harness returned a mismatched Project Storage request.",
} as const;

const protocolText = {
  ...bridgeNeutralText.protocol,
  uncorrelated: "Harness returned an uncorrelated Project Storage response.",
  undecodable: "Harness returned an invalid Project Storage response.",
} as const;

/** The fixed text a Project Storage request answers for each fault. */
function faultText(fault: ProjectRequestFault): string {
  return Match.value(fault).pipe(
    Match.discriminatorsExhaustive("kind")({
      transport: () => bridgeNeutralText.transport,
      protocol: ({ reason }) => protocolText[reason],
      harness: ({ message }) => message,
      send: ({ code }) => harnessSendFailureMessage({ ok: false, error: { code } }),
      unsent: () => stoppedText,
      stopped: () => stoppedText,
      desktop: ({ reason }) => desktopText[reason],
    }),
  );
}

function brokenResult<Request, Result>(
  schema: Schema.Decoder<Result>,
  request: Request,
  message: string,
): Result {
  return decodeStrict(schema, {
    status: "broken",
    request,
    diagnostic: { code: "PROJECT_STORAGE_TRANSPORT_FAILED", message },
  });
}

export interface ProjectStorageBridgeClient {
  open(request: ProjectStorageOpenRequest): Promise<ProjectStorageOpenResult>;
  create(request: ProjectStorageCreateRequest): Promise<ProjectStorageCreateResult>;
  close(request: ProjectStorageCloseRequest): Promise<ProjectStorageCloseResult>;
  stop(): void;
}

/**
 * The Project Storage bridge over a request core. `afterStop` runs once, inside the bridge's own
 * stop: the standalone bridge ends its private core there; a shared one leaves the core alone.
 */
export function projectStorageBridgeOver(
  core: HarnessRequestCore,
  clock: Clock,
  afterStop: () => void,
): ProjectStorageBridgeClient {
  let stopped = false;
  const metadata = () => ({ messageId: clock.createId(), sentAt: clock.now() });
  function operation<Request, Result extends Readonly<{ request: Request }>>(
    request: Request,
    resultSchema: Schema.Decoder<Result>,
    createCommand: (request: Request) => DesktopMessage,
    event: HarnessMessage["event"],
  ): Promise<Result> {
    const broken = (fault: ProjectRequestFault) =>
      brokenResult(resultSchema, request, faultText(fault));
    if (stopped) return Promise.resolve(broken({ kind: "unsent" }));
    // An invalid request fails in the command builder, as `desktop` `invalid-command`. The echo
    // is checked against the command's validated payload, never the caller's object.
    let command: DesktopMessage | undefined;
    const build = () => {
      command = createCommand(request);
      return command;
    };
    return answerRequest(
      core.request("project-storage", build, event).pipe(
        Effect.flatMap((value) => decodeReply(resultSchema, value)),
        Effect.flatMap((result) =>
          isDeepStrictEqual(result.request, command?.payload)
            ? Effect.succeed(result)
            : Effect.fail({ kind: "desktop", reason: "mismatched-echo" } as const),
        ),
      ),
      broken,
    );
  }
  return {
    open: (request) =>
      operation(
        request,
        ProjectStorageOpenResultSchema,
        (decoded) => createProjectOpenCommand(metadata(), decoded),
        "project.open.result",
      ),
    create: (request) =>
      operation(
        request,
        ProjectStorageCreateResultSchema,
        (decoded) => createProjectCreateCommand(metadata(), decoded),
        "project.create.result",
      ),
    close: (request) =>
      operation(
        request,
        ProjectStorageCloseResultSchema,
        (decoded) => createProjectCloseCommand(metadata(), decoded),
        "project.close.result",
      ),
    stop: () => {
      if (stopped) return;
      stopped = true;
      // Settle first: an unsubscribe failure in `afterStop` surfaces only after.
      core.failBridge("project-storage", { kind: "stopped" });
      afterStop();
    },
  };
}

/** A standalone Project Storage bridge, with its own core over `session`. */
export function createProjectStorageBridge(
  options: ProjectStorageBridgeOptions,
): ProjectStorageBridgeClient {
  const core = makeHarnessRequestCore(options.session);
  return projectStorageBridgeOver(core, options, core.unsubscribe);
}
