import type { RegistryBrokenCode } from "@slopstop/protocol";
import { describe, expectTypeOf, it } from "vitest";
import type { RegistryFailure } from "./registration/registry-failure.js";
import type { CanonicalWriterLeaseFailureCode } from "./storage/canonical-writer-lease.js";

describe("protocol code tuples in the harness", () => {
  it("types the registry failure's broken code as the protocol registry-broken code", () => {
    expectTypeOf<
      Extract<RegistryFailure, { status: "broken" }>["code"]
    >().toEqualTypeOf<RegistryBrokenCode>();
  });

  it("types the writer lease failure codes as the 4 lease release codes", () => {
    expectTypeOf<CanonicalWriterLeaseFailureCode>().toEqualTypeOf<
      | "WRITER_LEASE_OPEN_FAILED"
      | "WRITER_LEASE_LOCK_FAILED"
      | "WRITER_LEASE_UNLOCK_FAILED"
      | "WRITER_LEASE_CLOSE_FAILED"
    >();
  });
});
