import { LowercaseDomainIdentityTextSchema, lowercaseDomainIdentity } from "@slopstop/kernel";
import { Schema } from "effect";

export { LowercaseDomainIdentityTextSchema };

export const ProjectIdSchema = lowercaseDomainIdentity(
  "Project identity must use lowercase UUID text.",
).pipe(Schema.brand("ProjectId"));
