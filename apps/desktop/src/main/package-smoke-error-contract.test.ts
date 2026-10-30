import { describe, expect, it } from "vitest";
import {
  PackageSmokeAuthorizationError,
  packageSmokeAuthorizationFailureMessage,
} from "./package-smoke-authorization.js";
import { WriterProofError } from "./package-smoke-verifier.js";
import { RegistrationPackageSmokeError } from "./registration-package-smoke.js";

type ErrorClass = abstract new (...args: never[]) => Error;

/** One exported smoke refusal and the contract it keeps: tag, class, message and stage. */
type ContractRow = Readonly<{
  tag: string;
  error: Error;
  errorClass: ErrorClass;
  message: string;
  stage?: string;
}>;

const contractRows: readonly ContractRow[] = [
  {
    tag: "PackageSmokeAuthorizationError",
    error: new PackageSmokeAuthorizationError(),
    errorClass: PackageSmokeAuthorizationError,
    message: "Package smoke authorization failed.",
  },
  {
    tag: "WriterProofError",
    error: new WriterProofError("native-preflight"),
    errorClass: WriterProofError,
    message: "Packaged Writer proof failed.",
    stage: "native-preflight",
  },
  {
    tag: "RegistrationPackageSmokeError",
    error: new RegistrationPackageSmokeError("list"),
    errorClass: RegistrationPackageSmokeError,
    message: "Packaged registration smoke failed.",
    stage: "list",
  },
];

describe("package smoke error contract", () => {
  describe.each(contractRows)("$tag", (row) => {
    const { tag, error, message, stage } = row;

    it("carries its tag", () => {
      expect(Reflect.get(error, "_tag")).toBe(tag);
    });

    it("is named by its class", () => {
      expect(error.name).toBe(tag);
    });

    it("keeps its error contract", () => {
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(row.errorClass);
      expect(error.message).toBe(row.message);
      if (error instanceof PackageSmokeAuthorizationError) {
        expect(error.message).toBe(packageSmokeAuthorizationFailureMessage);
      }
      if (row.stage !== undefined) expect(Reflect.get(error, "stage")).toBe(row.stage);
      expect(Object.hasOwn(error, "cause")).toBe(false);
    });

    it("prints its name and message", () => {
      expect(String(error)).toBe(`${tag}: ${message}`);
    });

    it("owns only its tag and stage", () => {
      expect(Object.keys(error).sort()).toEqual(stage === undefined ? ["_tag"] : ["_tag", "stage"]);
    });
  });

  describe("equality, decided by the own stage", () => {
    it("tells apart two registration refusals at different stages", () => {
      expect(new RegistrationPackageSmokeError("list")).not.toEqual(
        new RegistrationPackageSmokeError("register"),
      );
    });

    it("keeps two Writer proof refusals at one stage equal", () => {
      expect(new WriterProofError("cleanup")).toEqual(new WriterProofError("cleanup"));
    });

    it("tells apart two Writer proof refusals at different stages", () => {
      expect(new WriterProofError("cleanup")).not.toEqual(new WriterProofError("internal"));
    });
  });
});
