import type { Brand } from "effect";
import { Schema } from "effect";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export type DomainIdentity<Name extends string> = string & Brand.Brand<Name>;

// Brand each identity at its owner, for example `.pipe(Schema.brand("ProjectId"))`.
export const DomainIdentityTextSchema = Schema.String.check(
  Schema.isPattern(UUID_PATTERN, { expected: "UUID text" }),
);

// Case stays a separate filter, so structure and case report distinct issues.
export function lowercaseDomainIdentity(message: string) {
  return DomainIdentityTextSchema.check(
    Schema.makeFilter((value: string) => value === value.toLowerCase(), { message }),
  );
}

export const LowercaseDomainIdentityTextSchema = lowercaseDomainIdentity(
  "Identity must use lowercase UUID text.",
);

export const WorkspaceProjectionRevisionSchema = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0),
).pipe(Schema.brand("WorkspaceProjectionRevision"));
export type WorkspaceProjectionRevision = typeof WorkspaceProjectionRevisionSchema.Type;

const isDomainIdentityText = Schema.is(LowercaseDomainIdentityTextSchema);

export function isDomainIdentity(value: unknown): value is DomainIdentity<string> {
  return isDomainIdentityText(value);
}

export const isWorkspaceProjectionRevision = Schema.is(WorkspaceProjectionRevisionSchema);
