import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { decodeStrict, ProjectRegistrationRequestSchema } from "@slopstop/protocol";
import { Effect } from "effect";
import { expect, it, vi } from "vitest";
import { createProposalSteps } from "../../src/registration/registration-proposal-steps.js";
import {
  stopStandaloneAuthority,
  withRegistrationDatabase,
} from "../../src/registration/registry-database.js";
import { consentRegistryOptions } from "./registration-consent-fixture.js";
import { temporaryRoot } from "./temporary-root.js";

const prepareRequest = decodeStrict(ProjectRegistrationRequestSchema, {
  step: "prepare",
  preparationRequestId: randomUUID(),
  selectionId: randomUUID(),
  observationId: randomUUID(),
  identityQueryConsentId: randomUUID(),
  repositorySelectionId: randomUUID(),
  trustId: randomUUID(),
});

it("answers a prepared proposal missing from the registry as a corrupt registry", async () => {
  if (prepareRequest.step !== "prepare") throw new Error("Expected a prepare request.");
  const root = await temporaryRoot("p3-s5c-proposal-steps-");
  const options = consentRegistryOptions(root);
  try {
    // A real, migrated registry that holds no proposal for the request.
    await withRegistrationDatabase(options, async () => undefined);
    const owner = {
      prepare: vi.fn(async () => ({ status: "prepared", proposalFingerprint: "f".repeat(64) })),
      confirm: vi.fn(async () => ({ status: "registered" })),
    };
    const steps = createProposalSteps({ owner, options });
    expect(await Effect.runPromise(steps.prepare(prepareRequest))).toEqual({
      status: "broken",
      code: "REGISTRY_CORRUPT",
    });
    expect(owner.confirm).not.toHaveBeenCalled();
  } finally {
    await Effect.runPromise(Effect.result(stopStandaloneAuthority(options)));
    await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
});
