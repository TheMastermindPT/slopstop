import type { DomainIdentity, ProjectId as KernelProjectId } from "@slopstop/kernel";
import { isDomainIdentity } from "@slopstop/kernel";
import { z } from "zod";

export function domainIdentitySchema<T extends DomainIdentity<string>>() {
  return z.custom<T>((value) => isDomainIdentity(value));
}

export function lowercaseDomainIdentitySchema<T extends DomainIdentity<string>>(
  schema: z.ZodType<T>,
  message = "Identity must use lowercase UUID text.",
) {
  return schema.refine((value) => value === value.toLowerCase(), { message });
}

export const ProjectIdSchema = lowercaseDomainIdentitySchema(
  domainIdentitySchema<KernelProjectId>(),
  "Project identity must use lowercase UUID text.",
);
