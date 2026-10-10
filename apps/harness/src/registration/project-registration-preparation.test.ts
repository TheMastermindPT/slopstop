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
