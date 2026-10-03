import { DomainIdentityTextSchema } from "@slopstop/kernel";
import { Schema } from "effect";

function lowercaseIdentity(message: string) {
  return DomainIdentityTextSchema.check(
    Schema.makeFilter((value: string) => value === value.toLowerCase(), { message }),
  );
}

export const LowercaseDomainIdentityTextSchema = lowercaseIdentity(
  "Identity must use lowercase UUID text.",
);

export const ProjectIdSchema = lowercaseIdentity(
  "Project identity must use lowercase UUID text.",
).pipe(Schema.brand("ProjectId"));
