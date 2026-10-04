import type {
  GitVersionInspectionPort,
  GitVersionInspectionRequest,
  GitVersionInspectionResult,
} from "../project-registration-observer.js";
import type { ExecutableIdentity } from "./executable-identity.js";

export interface VersionConsentAuthority {
  resolve(request: GitVersionInspectionRequest): Promise<
    | Readonly<{ status: "unconfirmed" }>
    | Readonly<{
        status: "accepted";
        executablePath: string;
        executableIdentity: ExecutableIdentity;
      }>
  >;
}

export interface VersionObservationExecution {
  inspect(
    request: Readonly<{
      executablePath: string;
      executableIdentity: ExecutableIdentity;
      selectionId: GitVersionInspectionRequest["selectionId"];
      consentId: NonNullable<GitVersionInspectionRequest["consentId"]>;
    }>,
    signal?: AbortSignal,
  ): Promise<GitVersionInspectionResult>;
}

export function createGitVersionInspection(
  authority: VersionConsentAuthority,
  execution: VersionObservationExecution,
): GitVersionInspectionPort {
  return {
    inspect: async (request, signal) => {
      const consent = await authority.resolve(request);
      if (signal?.aborted) return { status: "cancelled" };
      if (consent.status === "unconfirmed" || request.consentId === null) {
        return { status: "unavailable", code: "GIT_CONFIRMATION_REQUIRED" };
      }
      return execution.inspect(
        {
          executablePath: consent.executablePath,
          executableIdentity: consent.executableIdentity,
          selectionId: request.selectionId,
          consentId: request.consentId,
        },
        signal,
      );
    },
  };
}
