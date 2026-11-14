import { EventEmitter } from "node:events";
import { decodeStrict, HarnessBootstrapSchema, MessageIdSchema } from "@slopstop/protocol";
import type { Logger } from "pino";
import { expect, type Mock, vi } from "vitest";
import { HarnessShutdownTimeout, HarnessSupervisor } from "./harness-supervisor.js";

/** The Electron doubles a supervisor test hoists and mocks `electron` with. */
type ElectronMocks = Readonly<{ createChannel: Mock; fork: Mock; MessageChannelMain: Mock }>;

class FakePort extends EventEmitter {
  readonly close = vi.fn();
  readonly postMessage = vi.fn();
  readonly start = vi.fn();
}

export class FakeChild extends EventEmitter {
  readonly kill = vi.fn();
  readonly postMessage = vi.fn();
  readonly stderr: EventEmitter | undefined;
  readonly stdout: EventEmitter | undefined;

  constructor(withOutput = true) {
    super();
    this.stderr = withOutput ? new EventEmitter() : undefined;
    this.stdout = withOutput ? new EventEmitter() : undefined;
  }
}

type FakeChannel = Readonly<{
  port1: FakePort;
  port2: FakePort;
}>;

/** The supervisor's shutdown timeout: a typed failure that keeps its message (P-S5B-1). */
export function expectShutdownTimeout(outcome: unknown) {
  expect(outcome).toBeInstanceOf(HarnessShutdownTimeout);
  expect(outcome).toBeInstanceOf(Error);
  expect(outcome).toMatchObject({
    _tag: "HarnessShutdownTimeout",
    message: "Harness shutdown timed out.",
  });
}

export const logger = {
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
} as unknown as Logger;

export const eventMetadata = {
  messageId: decodeStrict(MessageIdSchema, "00000000-0000-4000-8000-000000000002"),
  sentAt: "2026-08-14T12:00:01.000Z",
  sequence: 1,
  causationId: decodeStrict(MessageIdSchema, "00000000-0000-4000-8000-000000000001"),
};
export const bootstrap = decodeStrict(HarnessBootstrapSchema, {
  kind: "harness.connect",
  applicationStorageRootUrl: "file:///C:/Users/example/AppData/SlopStop/storage",
  migrationResourcesRootUrl: "file:///C:/app/harness-migrations",
});

/** The channels the supervisor opened in the current test, oldest first. */
export const channels: FakeChannel[] = [];

/** The n-th id and time of a counter clock: values no real read gives. */
export const clockId = (n: number) => `10000000-2001-4000-8000-${String(n).padStart(12, "0")}`;
export const clockTime = (n: number) => new Date(Date.UTC(2001, 0, 1) + n * 1000).toISOString();
/** A counter clock: the n-th `createId()` returns `clockId(n)`, the n-th `now()` `clockTime(n)`. */
export function counterClock() {
  let ids = 0;
  let times = 0;
  return { createId: vi.fn(() => clockId(++ids)), now: vi.fn(() => clockTime(++times)) };
}

let electron: ElectronMocks | undefined;

/**
 * Resets the shared doubles before a test: no channels, a fresh fork, a quiet logger. Every new
 * channel's `port2` throws on post while `failPosts()` answers true.
 */
export function resetSupervisorDoubles(mocks: ElectronMocks, failPosts = () => false): void {
  electron = mocks;
  channels.length = 0;
  mocks.MessageChannelMain.mockImplementation(mocks.createChannel);
  // A function declaration: the supervisor constructs the channel with `new`.
  mocks.createChannel.mockImplementation(function createChannel() {
    const channel = { port1: new FakePort(), port2: new FakePort() };
    if (failPosts()) {
      channel.port2.postMessage.mockImplementation(() => {
        throw new Error("send failed");
      });
    }
    channels.push(channel);
    return channel;
  });
  mocks.fork.mockReset();
  vi.mocked(logger.error).mockReset();
  vi.mocked(logger.info).mockReset();
  vi.mocked(logger.warn).mockReset();
}

/** A supervisor whose forks hand out `children` in order, over a counter clock by default. */
export function supervisorWith(children: FakeChild[], clock = counterClock()): HarnessSupervisor {
  if (electron === undefined) throw new Error("Supervisor doubles were not reset.");
  electron.fork.mockImplementation(() => {
    const child = children.shift();
    if (child === undefined) {
      throw new Error("Test did not provide a child process.");
    }
    return child;
  });
  return new HarnessSupervisor("C:/app/harness.cjs", logger, bootstrap, clock);
}
