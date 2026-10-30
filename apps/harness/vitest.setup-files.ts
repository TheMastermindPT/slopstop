import path from "node:path";

/** The setup file every harness test project loads: the error equality tester. */
export const errorEqualitySetup = path.join(import.meta.dirname, "tests/error-equality.ts");
