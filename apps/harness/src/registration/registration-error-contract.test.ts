import { describe, expect, it } from "vitest";
import { RegistrationPublicationCancelled } from "./registration-confirmation-store.js";
import { RegistryReadFailed, registryReadRejection } from "./registry-effect.js";
import {
  type RegistryFailure,
  RegistryFault,
  registryCorruptFailure,
  registryFailure,
} from "./registry-failure.js";
import { WindowsObserverApiError } from "./windows-observer-api.js";

type ErrorClass = abstract new (...args: never[]) => Error;

/** One exported registration error and the contract it keeps: tag, class, message and field. */
type ContractRow = Readonly<{
  tag: string;
  error: Error;
  errorClass: ErrorClass;
  message: string;
  field?: readonly [key: string, value: unknown];
}>;

const corrupt: RegistryFailure = { status: "broken", code: "REGISTRY_CORRUPT" };
const busy: RegistryFailure = { status: "unavailable", code: "REGISTRY_BUSY" };

const contractRows: readonly ContractRow[] = [
  {
    tag: "RegistryFault",
    error: new RegistryFault(corrupt),
    errorClass: RegistryFault,
    message: "Project registration registry refused the operation.",
    field: ["failure", corrupt],
  },
  {
    tag: "WindowsObserverApiError",
    error: new WindowsObserverApiError(5),
    errorClass: WindowsObserverApiError,
    message: "Windows observer API failed (5).",
    field: ["code", 5],
  },
  {
    tag: "RegistrationPublicationCancelled",
    error: new RegistrationPublicationCancelled(),
    errorClass: RegistrationPublicationCancelled,
    message: "",
  },
];

describe("registration error contract", () => {
  it.each(contractRows)("$tag carries its tag", ({ tag, error }) => {
    expect(Reflect.get(error, "_tag")).toBe(tag);
  });

  it.each(contractRows)("$tag is named by its class", ({ tag, error }) => {
    expect(error.name).toBe(tag);
  });

  it.each(contractRows)("$tag keeps its error contract", (row) => {
    const { error } = row;
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(row.errorClass);
    expect(error.message).toBe(row.message);
    if (row.field !== undefined) expect(Reflect.get(error, row.field[0])).toBe(row.field[1]);
    expect(String(error)).toBe(row.message === "" ? row.tag : `${row.tag}: ${row.message}`);
    expect(Object.hasOwn(error, "cause")).toBe(false);
  });

  describe("equality", () => {
    it("keeps two registry faults with equal failures equal", () => {
      expect(new RegistryFault(registryCorruptFailure)).toEqual(
        new RegistryFault({ status: "broken", code: "REGISTRY_CORRUPT" }),
      );
    });

    it("tells apart two registry faults with different failures", () => {
      expect(new RegistryFault(registryCorruptFailure)).not.toEqual(new RegistryFault(busy));
    });

    it("tells apart two Windows observer API errors with different codes", () => {
      expect(new WindowsObserverApiError(5)).not.toEqual(new WindowsObserverApiError(6));
    });
  });

  describe("registry verdict", () => {
    it("answers a registry fault with its own failure", () => {
      expect(registryFailure(new RegistryFault(busy))).toBe(busy);
    });

    it("answers a rejected registry read with the read's failure", () => {
      const rejection = registryReadRejection(
        new RegistryReadFailed({ failure: registryCorruptFailure }),
      );
      expect(registryFailure(rejection)).toEqual(registryCorruptFailure);
    });

    it("rejects an internal read failure as the read itself", () => {
      const failed = new RegistryReadFailed({
        failure: { status: "broken", code: "INTERNAL_FAILURE" },
      });
      expect(registryReadRejection(failed)).toBe(failed);
    });
  });
});
