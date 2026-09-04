import type { DomainIdentity, ProjectId as KernelProjectId } from "@slopstop/kernel";
import { isDomainIdentity } from "@slopstop/kernel";
import { z } from "zod";

export function domainIdentitySchema<T extends DomainIdentity<string>>() {
  return z.custom<T>((value) => isDomainIdentity(value));
}

export const ProjectIdSchema = domainIdentitySchema<KernelProjectId>().refine(
  (value) => value === value.toLowerCase(),
  "Project identity must use lowercase UUID text.",
);
