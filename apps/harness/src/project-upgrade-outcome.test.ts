import {
  decodeStrict,
  ProjectUpgradeRequestSchema,
  projectUpgradeDiagnostics,
} from "@slopstop/protocol";
import { expect, it } from "vitest";
import { projectUpgradeResult } from "./project-upgrade-outcome.js";

const request = decodeStrict(ProjectUpgradeRequestSchema, {
  projectId: "00000000-0000-4000-8000-000000000010",
});
const rows = projectUpgradeDiagnostics;

it("maps an unavailable storage outcome to the busy row only when the outcome says busy", () => {
  expect(
    projectUpgradeResult(request, {
      status: "unavailable",
      reason: "busy",
      message: "Project Storage owner is stopped.",
    }),
  ).toEqual({ status: "unavailable", request, diagnostic: rows.storageBusy });
  // The text alone never decides: the discriminant does.
  expect(
    projectUpgradeResult(request, {
      status: "unavailable",
      reason: "unavailable",
      message: rows.storageBusy.message,
    }),
  ).toEqual({ status: "unavailable", request, diagnostic: rows.storageUnavailable });
});
