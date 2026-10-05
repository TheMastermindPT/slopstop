import path from "node:path";
import type { ProjectRegistrationRequest, ProjectRegistrationResult } from "@slopstop/protocol";
import { packageSmokeRepositoryDirectory } from "./package-smoke-authorization.js";

type RegistrationSmokeStage = "select" | "register" | "list";

export class RegistrationPackageSmokeError extends Error {
  override readonly name = "RegistrationPackageSmokeError";

  constructor(readonly stage: RegistrationSmokeStage) {
    super("Packaged registration smoke failed.");
  }
}

// Runs in the packaged renderer through window.slopstop. It receives only the selection id:
// trust, both Git stages, preparation, confirmation, then the saved list.
function rendererRegistrationScript(repositorySelectionId: string): string {
  return `(async () => {
  const api = window.slopstop;
  const uuid = () => crypto.randomUUID();
  const repositorySelectionId = ${JSON.stringify(repositorySelectionId)};
  const trustId = uuid();
  const trusted = await api.registerProject({ step: "decide-trust", repositorySelectionId, trustId, decision: "accepted" });
  if (trusted.status !== "trust-recorded") return { result: trusted };
  const git = await api.registerProject({ step: "prepare-git" });
  if (git.status !== "git-prepared") return { result: git };
  const version = await api.registerProject({ step: "decide-git-version", selectionId: git.selectionId, consentId: uuid(), decision: "accepted" });
  if (version.status !== "git-version-observed") return { result: version };
  const consent = { selectionId: git.selectionId, observationId: version.observationId, consentId: uuid() };
  const recorded = await api.registerProject({ step: "decide-identity-queries", ...consent, decision: "accepted" });
  if (recorded.status !== "identity-queries-recorded") return { result: recorded };
  const preparation = { preparationRequestId: uuid(), ...consent, repositorySelectionId, trustId };
  const proposal = await api.registerProject({ step: "prepare", ...preparation });
  if (proposal.status !== "proposal-prepared") return { result: proposal };
  const result = await api.registerProject({ step: "confirm", requestId: uuid(), ...preparation, proposalId: proposal.proposalId, proposalFingerprint: proposal.proposalFingerprint });
  return { result, list: await api.listProjects() };
})()`;
}

function fieldOf(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;
}

// The one saved Project the proof expects, or undefined.
function onlyProject(list: unknown): unknown {
  const projects = fieldOf(list, "projects");
  if (fieldOf(list, "status") !== "listed" || !Array.isArray(projects)) return undefined;
  return projects.length === 1 ? projects[0] : undefined;
}

function listsRepository(list: unknown): boolean {
  const project = onlyProject(list);
  return (
    fieldOf(project, "registration") === "registered" && fieldOf(project, "name") === "repository"
  );
}

/**
 * The packaged registration proof. Main selects the authorized root's repository itself,
 * as its folder dialog would; the packaged renderer then drives every other step and reads
 * the list. No path ever reaches the renderer.
 */
export async function runRegistrationPackageSmoke(
  input: Readonly<{
    root: string;
    register(request: ProjectRegistrationRequest): Promise<ProjectRegistrationResult>;
    runInRenderer(script: string): Promise<unknown>;
  }>,
): Promise<void> {
  const selected = await input.register({
    step: "select-repository",
    directory: path.join(input.root, packageSmokeRepositoryDirectory),
  });
  if (selected.status !== "repository-selected") throw new RegistrationPackageSmokeError("select");
  const rendered = await input.runInRenderer(
    rendererRegistrationScript(selected.repositorySelectionId),
  );
  const result = fieldOf(rendered, "result");
  if (fieldOf(result, "status") !== "registered" || fieldOf(result, "name") !== "repository")
    throw new RegistrationPackageSmokeError("register");
  if (!listsRepository(fieldOf(rendered, "list"))) throw new RegistrationPackageSmokeError("list");
}
