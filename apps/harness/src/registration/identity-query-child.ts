import { z } from "zod";
import type { RepositoryPhysicalSnapshot } from "./physical-identity.js";
import type {
  GitVersionChildPort,
  WindowsObserverChildIdentity,
} from "./version-observation-execution.js";

export type IdentityQueryChildRequest = Readonly<{
  executablePath: string;
  repositoryDirectory: string;
  query: IdentityQueryKind;
  observationId: string;
  onOwned(child: WindowsObserverChildIdentity): Promise<void>;
}>;
export interface IdentityQueryChildPort {
  run(
    request: IdentityQueryChildRequest,
    signal?: AbortSignal,
  ): ReturnType<GitVersionChildPort["run"]>;
}

export const identityQueryKinds = [
  "inside-work-tree",
  "bare-repository",
  "inside-git-dir",
  "show-toplevel",
  "absolute-git-dir",
  "git-common-dir",
] as const;
export const IdentityQueryKindSchema = z.enum(identityQueryKinds);
export type IdentityQueryKind = z.infer<typeof IdentityQueryKindSchema>;

const prefix = [
  "--no-pager",
  "--no-optional-locks",
  "-c",
  "core.fsmonitor=false",
  "-c",
  "maintenance.auto=false",
  "-c",
  "gc.auto=0",
  "-c",
  "protocol.allow=never",
  "-c",
  "safe.directory=",
  "-c",
  "safe.bareRepository=explicit",
  "rev-parse",
] as const;
const suffixes = {
  "inside-work-tree": ["--is-inside-work-tree"],
  "bare-repository": ["--is-bare-repository"],
  "inside-git-dir": ["--is-inside-git-dir"],
  "show-toplevel": ["--path-format=absolute", "--show-toplevel"],
  "absolute-git-dir": ["--absolute-git-dir"],
  "git-common-dir": ["--path-format=absolute", "--git-common-dir"],
} as const;

export function identityQueryArguments(query: IdentityQueryKind): readonly string[] {
  return [...prefix, ...suffixes[IdentityQueryKindSchema.parse(query)]];
}

export type IdentityQueryDispatch = Readonly<{
  phaseId: string;
  ordinal: number;
  query: IdentityQueryKind;
  physical?: RepositoryPhysicalSnapshot;
}>;
