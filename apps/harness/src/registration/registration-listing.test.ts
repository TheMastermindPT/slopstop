import { Effect, Exit, Result } from "effect";
import { expect, it, vi } from "vitest";
import { advance, track } from "../../tests/integration/application-database-close-fixture.js";
import { createRegistrationListing } from "./registration-listing.js";

const closed = { status: "closed" } as const;
const unconfirmed = { status: "pending-recovery", code: "OBSERVER_CLEANUP_UNCONFIRMED" } as const;

/** The adapter over fake ports: the listing and observer answers, and a registry stop. */
function listing(
  ports: Readonly<{
    listing: Readonly<{ status: string }>;
    observer: Readonly<{ status: string }>;
    registryStop?: () => Promise<void>;
  }>,
) {
  return createRegistrationListing({
    owner: {
      listProjects: async () => ({ status: "listed", projects: [], hiddenCount: 0 }),
      close: vi.fn(async () => ports.listing),
    },
    observer: { closeEffect: Effect.promise(async () => ports.observer) },
    registry: { stop: vi.fn(ports.registryStop ?? (async () => undefined)) },
  });
}

/** The typed failure `stop` fails with: its tag, name, unconfirmed parts, message and cause. */
async function stopFailure(adapter: ReturnType<typeof listing>) {
  const found = Exit.findError(await Effect.runPromiseExit(adapter.stop));
  const error: unknown = Result.isSuccess(found) ? found.success : undefined;
  if (!(error instanceof Error)) throw new Error("Expected stop to fail with a typed error.");
  return {
    _tag: Reflect.get(error, "_tag"),
    name: error.name,
    parts: Reflect.get(error, "parts"),
    message: error.message,
    cause: error.cause,
    hasCause: Object.hasOwn(error, "cause"),
  };
}

const registryFailure = new Error("private registry stop failure");

type FailureRow = Readonly<{
  name: string;
  listing: Readonly<{ status: string }>;
  observer: Readonly<{ status: string }>;
  registryStop?: Error;
  parts: readonly string[];
}>;

const failureRows: readonly FailureRow[] = [
  {
    name: "observer and listing",
    listing: unconfirmed,
    observer: unconfirmed,
    parts: ["observer", "listing"],
  },
  {
    name: "a failed registry stop with the other parts, as the cause",
    listing: unconfirmed,
    observer: unconfirmed,
    registryStop: registryFailure,
    parts: ["registry", "observer", "listing"],
  },
  { name: "only the listing", listing: unconfirmed, observer: closed, parts: ["listing"] },
  {
    name: "only the registry",
    listing: closed,
    observer: closed,
    registryStop: registryFailure,
    parts: ["registry"],
  },
];

it.each(failureRows)("names every unconfirmed part: $name (CNV-B37)", async (row) => {
  const failure = row.registryStop;
  const adapter = listing({
    listing: row.listing,
    observer: row.observer,
    ...(failure === undefined
      ? {}
      : {
          registryStop: async () => {
            throw failure;
          },
        }),
  });
  expect(await stopFailure(adapter)).toEqual({
    _tag: "RegistrationCleanupUnconfirmed",
    name: "RegistrationCleanupUnconfirmed",
    parts: row.parts,
    message: `Project registration cleanup is unconfirmed: ${row.parts.join(", ")}.`,
    cause: failure,
    hasCause: failure !== undefined,
  });
});

it("lists the owner's Projects through the strict schema (CNV-B37)", async () => {
  expect(await listing({ listing: closed, observer: closed }).list()).toEqual({
    status: "listed",
    projects: [],
    hiddenCount: 0,
  });
});

it("stops when every part is confirmed (CNV-B37)", async () => {
  const exit = await Effect.runPromiseExit(listing({ listing: closed, observer: closed }).stop);
  expect(exit).toEqual(Exit.void);
});

type Answer<Value> = () => Promise<Value>;
const never =
  <Value>(): Answer<Value> =>
  () =>
    new Promise<Value>(() => undefined);
const at =
  <Value>(milliseconds: number, value: Value): Answer<Value> =>
  () =>
    new Promise<Value>((resolve) => setTimeout(() => resolve(value), milliseconds));
const now =
  <Value>(value: Value): Answer<Value> =>
  async () =>
    value;
const shutdownRegistryFailure = new Error("private registry stop failure at the budget edge");

type BudgetRow = Readonly<{
  name: string;
  owner: Answer<Readonly<{ status: string }>>;
  observer?: Answer<Readonly<{ status: string }>>;
  registry?: Answer<void>;
  settlesAt: number;
  parts: readonly string[];
  cause?: Error;
  observerCalled: boolean;
  registryCalled: boolean;
  /** Advances to this time after the failure, which must stay unchanged. */
  lateUntil?: number;
}>;

const budgetRows: readonly BudgetRow[] = [
  {
    name: "the owner close never settles",
    owner: never(),
    settlesAt: 3_000,
    parts: ["registry", "observer", "listing"],
    observerCalled: false,
    registryCalled: false,
  },
  {
    name: "the observer close never settles",
    owner: now(closed),
    observer: never(),
    settlesAt: 3_000,
    parts: ["registry", "observer"],
    observerCalled: true,
    registryCalled: false,
  },
  {
    name: "the registry stop never settles",
    owner: now(closed),
    observer: now(closed),
    registry: never(),
    settlesAt: 3_000,
    parts: ["registry"],
    observerCalled: true,
    registryCalled: true,
  },
  {
    name: "the registry stop fails at 2 999 ms",
    owner: now(closed),
    observer: now(closed),
    registry: () =>
      new Promise<void>((_, reject) => setTimeout(() => reject(shutdownRegistryFailure), 2_999)),
    settlesAt: 2_999,
    parts: ["registry"],
    cause: shutdownRegistryFailure,
    observerCalled: true,
    registryCalled: true,
  },
  {
    name: "the owner closes at 2 000 ms, the observer never settles",
    owner: at(2_000, closed),
    observer: never(),
    settlesAt: 3_000,
    parts: ["registry", "observer"],
    observerCalled: true,
    registryCalled: false,
  },
  {
    name: 'the observer closes "closed" at 3 500 ms',
    owner: now(closed),
    observer: at(3_500, closed),
    settlesAt: 3_000,
    parts: ["registry", "observer"],
    observerCalled: true,
    registryCalled: false,
    lateUntil: 4_000,
  },
  {
    name: "the owner is pending recovery, the observer never settles",
    owner: now(unconfirmed),
    observer: never(),
    settlesAt: 3_000,
    parts: ["registry", "observer", "listing"],
    observerCalled: true,
    registryCalled: false,
  },
  {
    name: "the observer is pending recovery, the registry stop never settles",
    owner: now(closed),
    observer: now(unconfirmed),
    registry: never(),
    settlesAt: 3_000,
    parts: ["registry", "observer"],
    observerCalled: true,
    registryCalled: true,
  },
];

/** The typed failure in a settled stop Exit: its unconfirmed parts and cause. */
function budgetFailure(exit: unknown) {
  if (!Exit.isExit(exit)) throw new Error("Expected the stop to settle with an Exit.");
  const found = Exit.findError(exit);
  const error: unknown = Result.isSuccess(found) ? found.success : undefined;
  if (!(error instanceof Error)) throw new Error("Expected stop to fail with a typed error.");
  return {
    parts: Reflect.get(error, "parts"),
    cause: error.cause,
    hasCause: Object.hasOwn(error, "cause"),
  };
}

it.each(budgetRows)("bounds the shutdown cleanup by its budget: $name", async (row) => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  try {
    const ownerClose = vi.fn(row.owner);
    const observerClose = vi.fn(row.observer ?? now(closed));
    const registryStop = vi.fn(row.registry ?? (async () => undefined));
    const adapter = createRegistrationListing({
      owner: {
        listProjects: async () => ({ status: "listed", projects: [], hiddenCount: 0 }),
        close: ownerClose,
      },
      observer: { closeEffect: Effect.suspend(() => Effect.promise(observerClose)) },
      registry: { stop: registryStop },
    });
    const stopping = track(Effect.runPromiseExit(adapter.stop));
    // The owner close starts in the caller's turn, before any await.
    expect(ownerClose).toHaveBeenCalledOnce();
    await advance(row.settlesAt - 1);
    expect(stopping.state).toBe("pending");
    await advance(1);
    expect(stopping.state).toBe("resolved");
    const expected = { parts: row.parts, cause: row.cause, hasCause: row.cause !== undefined };
    expect(budgetFailure(stopping.value)).toEqual(expected);
    if (row.lateUntil !== undefined) {
      await advance(row.lateUntil - row.settlesAt);
      expect(budgetFailure(stopping.value)).toEqual(expected);
    }
    expect(ownerClose).toHaveBeenCalledOnce();
    expect(observerClose).toHaveBeenCalledTimes(row.observerCalled ? 1 : 0);
    expect(registryStop).toHaveBeenCalledTimes(row.registryCalled ? 1 : 0);
  } finally {
    vi.useRealTimers();
  }
});

it("the observer close is interrupted at the budget", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  try {
    const calls: string[] = [];
    const registryStop = vi.fn(async () => undefined);
    const adapter = createRegistrationListing({
      owner: {
        listProjects: async () => ({ status: "listed", projects: [], hiddenCount: 0 }),
        close: async () => closed,
      },
      observer: {
        closeEffect: Effect.never.pipe(
          Effect.onInterrupt(() => Effect.sync(() => calls.push("observer-interrupted"))),
        ),
      },
      registry: { stop: registryStop },
    });
    const stopping = track(Effect.runPromiseExit(adapter.stop));
    await advance(2_999);
    expect(stopping.state).toBe("pending");
    await advance(1);
    expect(stopping.state).toBe("resolved");
    expect(budgetFailure(stopping.value)).toEqual({
      parts: ["registry", "observer"],
      cause: undefined,
      hasCause: false,
    });
    expect(registryStop).not.toHaveBeenCalled();
    expect(calls).toEqual(["observer-interrupted"]);
  } finally {
    vi.useRealTimers();
  }
});
