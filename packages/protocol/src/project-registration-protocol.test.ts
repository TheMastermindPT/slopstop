import type { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { decodeWithIssues } from "./decode-with-issues.test-support.js";
import {
  ExecutableConsentIdSchema,
  ExecutableSelectionIdSchema,
  IdentityQueryConsentIdSchema,
  InitialRepositoryBindingSchema,
  ProjectRegistrationRequestSchema,
  ProjectRegistrationResultSchema,
  RegisteredProjectSchema,
  RegistrationPreparationRequestIdSchema,
  RegistrationProposalIdSchema,
  RegistrationRequestIdSchema,
  RendererRegistrationRequestSchema,
  RepositoryBindingIdSchema,
  RepositoryChoiceResultSchema,
  RepositorySelectionIdSchema,
  RepositoryTrustIdSchema,
  VersionObservationIdSchema,
  WorkspaceIdSchema,
} from "./index.js";

const id = (suffix: number) =>
  `018f47a3-4e3d-7d2b-9c41-7df4605c0${String(suffix).padStart(3, "0")}`;
const nil = "00000000-0000-0000-0000-000000000000";
const max = "ffffffff-ffff-ffff-ffff-ffffffffffff";
const fingerprint = "a".repeat(64);
const preparation = {
  preparationRequestId: id(1),
  selectionId: id(2),
  observationId: id(3),
  identityQueryConsentId: id(4),
  repositorySelectionId: id(5),
  trustId: id(6),
};
const preparationFields = Object.keys(preparation);

const rendererSteps: ReadonlyArray<readonly [Record<string, unknown>, readonly string[]]> = [
  [
    { step: "decide-trust", repositorySelectionId: id(5), trustId: id(6), decision: "accepted" },
    ["repositorySelectionId", "trustId"],
  ],
  [
    {
      step: "decide-git-version",
      selectionId: id(2),
      executableConsentId: id(17),
      decision: "accepted",
    },
    ["selectionId", "executableConsentId"],
  ],
  [
    {
      step: "decide-identity-queries",
      selectionId: id(2),
      observationId: id(3),
      identityQueryConsentId: id(4),
      decision: "declined",
    },
    ["selectionId", "observationId", "identityQueryConsentId"],
  ],
  [{ step: "prepare", ...preparation }, preparationFields],
  [
    {
      step: "confirm",
      requestId: id(7),
      ...preparation,
      proposalId: id(8),
      proposalFingerprint: fingerprint,
    },
    ["requestId", ...preparationFields, "proposalId"],
  ],
];

const results: ReadonlyArray<readonly [Record<string, unknown>, readonly string[]]> = [
  [{ status: "repository-selected", repositorySelectionId: id(5) }, ["repositorySelectionId"]],
  [{ status: "git-prepared", selectionId: id(2), executablePath: "git" }, ["selectionId"]],
  [
    { status: "git-version-observed", selectionId: id(2), observationId: id(3), version: "2.47" },
    ["selectionId", "observationId"],
  ],
  [
    {
      status: "proposal-prepared",
      proposalId: id(8),
      proposalFingerprint: fingerprint,
      name: "repo",
      repositoryDirectory: "C:/repo",
      worktree: "C:/repo",
      gitVersion: "2.47",
    },
    ["proposalId"],
  ],
];

const initialBinding = {
  projectId: id(9),
  createRequestId: id(10),
  reservationId: id(11),
  reservationFingerprint: fingerprint,
  repositoryBindingId: id(12),
  workspaceId: id(13),
  registrationRequestId: id(14),
};
const registeredProject = {
  status: "registered",
  requestId: id(7),
  proposalId: id(8),
  projectId: id(9),
  repositoryBindingId: id(12),
  workspaceId: id(13),
  storageId: id(15),
  generationId: id(16),
};

type Row = readonly [string, Schema.ConstraintDecoder<unknown>, Record<string, unknown>, string];

function rows(
  name: string,
  schema: Schema.ConstraintDecoder<unknown>,
  value: Record<string, unknown>,
  fields: readonly string[],
) {
  return fields.map(
    (field): Row => [
      `${name} ${String(value["step"] ?? value["status"] ?? "")} ${field}`,
      schema,
      value,
      field,
    ],
  );
}

const cases: Row[] = [
  ...rendererSteps.flatMap(([value, fields]) => [
    ...rows("RendererRegistrationRequest", RendererRegistrationRequestSchema, value, fields),
    ...rows("ProjectRegistrationRequest", ProjectRegistrationRequestSchema, value, fields),
  ]),
  ...results.flatMap(([value, fields]) =>
    rows("ProjectRegistrationResult", ProjectRegistrationResultSchema, value, fields),
  ),
  ...rows(
    "RepositoryChoiceResult",
    RepositoryChoiceResultSchema,
    { status: "repository-selected", repositorySelectionId: id(5), directory: "C:/repo" },
    ["repositorySelectionId"],
  ),
  ...rows("InitialRepositoryBinding", InitialRepositoryBindingSchema, initialBinding, [
    "reservationId",
    "repositoryBindingId",
    "workspaceId",
    "registrationRequestId",
  ]),
  ...rows("RegisteredProject", RegisteredProjectSchema, registeredProject, [
    "requestId",
    "proposalId",
    "repositoryBindingId",
    "workspaceId",
  ]),
];

describe("project registration identities", () => {
  it.each(cases)(
    "rejects a non-strict registration identity (%s)",
    (_name, schema, value, field) => {
      expect(decodeWithIssues(schema, value).success).toBe(true);
      const valid = String(value[field]);
      for (const bad of [nil, max, valid.toUpperCase()]) {
        const decoded = decodeWithIssues(schema, { ...value, [field]: bad });
        expect(decoded.success, bad).toBe(false);
        expect(
          decoded.error?.issues.map((issue) => issue.path),
          bad,
        ).toEqual([[field]]);
      }
    },
  );

  it.each([
    ["RepositoryBindingIdSchema", RepositoryBindingIdSchema],
    ["WorkspaceIdSchema", WorkspaceIdSchema],
    ["RegistrationRequestIdSchema", RegistrationRequestIdSchema],
    ["RegistrationProposalIdSchema", RegistrationProposalIdSchema],
  ] as const)("exports the strict %s brand", (_name, schema) => {
    expect(decodeWithIssues(schema, id(1)).success).toBe(true);
    expect(decodeWithIssues(schema, nil).success).toBe(false);
  });
});

/** The valid renderer request of `step` from the rows above. */
function stepRequest(step: string): Record<string, unknown> {
  const found = rendererSteps.find(([value]) => value["step"] === step);
  if (found === undefined) throw new Error(`No ${step} row`);
  return found[0];
}

const consentSteps = [
  ["decide-git-version", "executableConsentId"],
  ["decide-identity-queries", "identityQueryConsentId"],
  ["prepare", "identityQueryConsentId"],
  ["confirm", "identityQueryConsentId"],
] as const;

describe("registration consent names", () => {
  it.each(consentSteps)(
    "names the executable and identity-query consents apart (%s)",
    (step, key) => {
      const request = stepRequest(step);
      const { [key]: consent, ...rest } = request;
      const legacy = { ...rest, consentId: consent };
      for (const schema of [RendererRegistrationRequestSchema, ProjectRegistrationRequestSchema]) {
        expect(decodeWithIssues(schema, request).success).toBe(true);
        const decoded = decodeWithIssues(schema, legacy);
        // Unknown keys are reported at their owning object, naming the key.
        expect(decoded.error?.issues).toEqual([
          { code: "unrecognized_keys", path: [], keys: ["consentId"] },
          { code: "invalid_type", path: [key] },
        ]);
      }
    },
  );

  it.each([
    ["RegistrationPreparationRequestIdSchema", RegistrationPreparationRequestIdSchema],
    ["ExecutableSelectionIdSchema", ExecutableSelectionIdSchema],
    ["VersionObservationIdSchema", VersionObservationIdSchema],
    ["IdentityQueryConsentIdSchema", IdentityQueryConsentIdSchema],
    ["RepositorySelectionIdSchema", RepositorySelectionIdSchema],
    ["RepositoryTrustIdSchema", RepositoryTrustIdSchema],
    ["ExecutableConsentIdSchema", ExecutableConsentIdSchema],
  ] as const)("exports the registration flow brands (%s)", (_name, schema) => {
    expect(decodeWithIssues(schema, id(1)).success).toBe(true);
    expect(decodeWithIssues(schema, nil).error?.issues).toEqual([
      { code: "invalid_format", path: [] },
    ]);
    expect(decodeWithIssues(schema, id(1).toUpperCase()).error?.issues).toEqual([
      { code: "custom", path: [], message: "Identity must use lowercase UUID text." },
    ]);
  });
});
