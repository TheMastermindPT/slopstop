import { expect, it, vi } from "vitest";
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
    observer: { close: vi.fn(async () => ports.observer) },
    registry: { stop: vi.fn(ports.registryStop ?? (async () => undefined)) },
  });
}

/** The error `stop` rejects with: its name, unconfirmed parts, message and cause. */
async function stopFailure(adapter: ReturnType<typeof listing>) {
  const error: unknown = await adapter.stop().then(
    () => undefined,
    (cause: unknown) => cause,
  );
  if (!(error instanceof Error)) throw new Error("Expected stop to reject.");
  return {
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
  await expect(listing({ listing: closed, observer: closed }).stop()).resolves.toBeUndefined();
});
