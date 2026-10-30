import { afterEach, expect, it, vi } from "vitest";
import { REGISTRATION_CLEANUP_BUDGET_MS } from "./observer-limits.js";
import { createProjectRegistrationPreparation } from "./project-registration-preparation.js";
import type { RepositoryTrustOwner } from "./repository-trust.js";

/** A trust owner the listing never consults. */
const unusedRegistry: RepositoryTrustOwner = {
  selectRepository: async () => {
    throw new Error("Repository selection is unused by this test.");
  },
  decideRepositoryTrust: async () => {
    throw new Error("Repository trust is unused by this test.");
  },
  admitRepositoryIdentityQueries: async () => {
    throw new Error("Identity query admission is unused by this test.");
  },
};

const options = { applicationStorageRoot: "unused", migrationResourcesRoot: "unused" };

type Listing = NonNullable<Parameters<typeof createProjectRegistrationPreparation>[5]>;

function owner(listing: Listing) {
  return createProjectRegistrationPreparation(
    unusedRegistry,
    options,
    "unused",
    undefined,
    undefined,
    listing,
  );
}

afterEach(() => {
  vi.useRealTimers();
});

it.each(["REGISTRY_CORRUPT", "REGISTRY_SCHEMA_UNKNOWN", "REGISTRY_SCHEMA_NEWER"] as const)(
  "closes after a broken %s listing whose cleanup completed (CNV-B37)",
  async (code) => {
    const preparation = owner(async () => ({ status: "broken", code }));
    expect(await preparation.listProjects()).toEqual({ status: "broken", code });
    expect(await preparation.close()).toEqual({ status: "closed" });
  },
);

it("closes after a successful listing (CNV-B37)", async () => {
  const listed = { status: "listed", projects: [], hiddenCount: 0 } as const;
  const preparation = owner(async () => listed);
  expect(await preparation.listProjects()).toEqual(listed);
  expect(await preparation.close()).toEqual({ status: "closed" });
});

it("stays broken after a listing whose own cleanup failed (CNV-B37)", async () => {
  const preparation = owner(async () => ({ status: "broken", code: "INTERNAL_FAILURE" }));
  await preparation.listProjects();
  expect(await preparation.close()).toEqual({ status: "broken", code: "INTERNAL_FAILURE" });
});

it("stays broken when a listing is still running past the cleanup budget (CNV-B37)", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const preparation = owner(() => new Promise(() => undefined));
  void preparation.listProjects();
  const closing = preparation.close();
  await vi.advanceTimersByTimeAsync(REGISTRATION_CLEANUP_BUDGET_MS);
  expect(await closing).toEqual({ status: "broken", code: "INTERNAL_FAILURE" });
});

it("answers cleanup unconfirmed when a listing rejects while close drains it (CNV-B37)", async () => {
  const preparation = owner(
    (signal) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("Listing failed on abort.")));
      }),
  );
  const listed = preparation.listProjects().catch((error: unknown) => error);
  expect(await preparation.close()).toEqual({
    status: "pending-recovery",
    code: "OBSERVER_CLEANUP_UNCONFIRMED",
  });
  expect(await listed).toBeInstanceOf(Error);
});

it("closes after a listing that rejected before close (CNV-B37)", async () => {
  const preparation = owner(async () => {
    throw new Error("Listing failed.");
  });
  await expect(preparation.listProjects()).rejects.toThrow("Listing failed.");
  expect(await preparation.close()).toEqual({ status: "closed" });
});

type ListingAnswer = Awaited<ReturnType<Listing>>;

/** A listing that answers only once close aborts it. */
function answersOnAbort(answer: ListingAnswer): Listing {
  return (signal) =>
    new Promise((resolve) => {
      signal.addEventListener("abort", () => resolve(answer));
    });
}

it("answers the listing-unavailable failure when no listing is given", async () => {
  const preparation = createProjectRegistrationPreparation(unusedRegistry, options, "unused");
  expect(await preparation.listProjects()).toEqual({ status: "broken", code: "INTERNAL_FAILURE" });
  expect(await preparation.close()).toEqual({ status: "closed" });
});

it("answers the same closing promise to every close", async () => {
  const preparation = owner(async () => ({ status: "listed", projects: [], hiddenCount: 0 }));
  const closing = preparation.close();
  expect(preparation.close()).toBe(closing);
  expect(await closing).toEqual({ status: "closed" });
});

it("answers cancelled without listing once closed", async () => {
  let listings = 0;
  const preparation = owner(async () => {
    listings += 1;
    return { status: "listed", projects: [], hiddenCount: 0 };
  });
  await preparation.close();
  expect(await preparation.listProjects()).toEqual({ status: "cancelled" });
  expect(listings).toBe(0);
});

it("closes after a listing that answers while close drains it", async () => {
  const preparation = owner(answersOnAbort({ status: "listed", projects: [], hiddenCount: 0 }));
  const listed = preparation.listProjects();
  expect(await preparation.close()).toEqual({ status: "closed" });
  expect(await listed).toEqual({ status: "cancelled" });
});

it("closes after a listing that answers a missing registry while close drains it", async () => {
  const missing = { status: "pending-recovery", code: "REGISTRY_MISSING_WITH_WITNESS" } as const;
  const preparation = owner(answersOnAbort(missing));
  const listed = preparation.listProjects();
  expect(await preparation.close()).toEqual({ status: "closed" });
  expect(await listed).toEqual(missing);
});

it("keeps a listing's broken answer when a later listing rejects while close drains it", async () => {
  let listings = 0;
  const preparation = owner((signal) => {
    listings += 1;
    if (listings === 1) return Promise.resolve({ status: "broken", code: "INTERNAL_FAILURE" });
    return new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error("Listing failed on abort.")));
    });
  });
  await preparation.listProjects();
  const rejected = preparation.listProjects().catch((error: unknown) => error);
  expect(await preparation.close()).toEqual({ status: "broken", code: "INTERNAL_FAILURE" });
  expect(await rejected).toBeInstanceOf(Error);
});

it("stays cleanup-unconfirmed when a listing answers cleanup unconfirmed while close drains it", async () => {
  const unconfirmed = { status: "pending-recovery", code: "OBSERVER_CLEANUP_UNCONFIRMED" } as const;
  const preparation = owner(answersOnAbort(unconfirmed));
  const listed = preparation.listProjects();
  expect(await preparation.close()).toEqual(unconfirmed);
  expect(await listed).toEqual(unconfirmed);
});
