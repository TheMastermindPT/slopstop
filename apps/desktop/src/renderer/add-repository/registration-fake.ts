import {
  decodeStrict,
  ProjectIdSchema,
  type ProjectListResult,
  ProjectListResultSchema,
  type ProjectRegistrationResult,
  type RendererRegistrationRequest,
  type RepositoryChoiceResult,
} from "@slopstop/protocol";
import { vi } from "vitest";
import type { SlopStopApi } from "../../shared/desktop-api.js";
import { readyApi } from "../test-api.js";

export const projectId = decodeStrict(ProjectIdSchema, "33333333-3333-4333-8333-333333333333");
export const gitPath = "C:\\Program Files\\Git\\cmd\\git.exe";
const ids = {
  repositorySelectionId: "44444444-4444-4444-8444-444444444444",
  selectionId: "55555555-5555-4555-8555-555555555555",
  observationId: "66666666-6666-4666-8666-666666666666",
  proposalId: "77777777-7777-4777-8777-777777777777",
};

type Step = RendererRegistrationRequest["step"];
type Answers = Partial<Record<Step, ProjectRegistrationResult | ProjectRegistrationResult[]>>;

const defaults: Record<Step, ProjectRegistrationResult> = {
  "decide-trust": { status: "trust-recorded" },
  "prepare-git": { status: "git-prepared", selectionId: ids.selectionId, executablePath: gitPath },
  "decide-git-version": {
    status: "git-version-observed",
    selectionId: ids.selectionId,
    observationId: ids.observationId,
    version: "2.53.0.windows.1",
  },
  "decide-identity-queries": { status: "identity-queries-recorded" },
  prepare: {
    status: "proposal-prepared",
    proposalId: ids.proposalId,
    proposalFingerprint: "a".repeat(64),
    name: "repository",
    repositoryDirectory: "C:\\work\\repository",
    worktree: "C:/work/repository",
    gitVersion: "2.53.0.windows.1",
  },
  confirm: { status: "registered", projectId, name: "repository" },
  "remove-from-list": { status: "removed", projectId },
};

function listedRepository(): ProjectListResult {
  return decodeStrict(ProjectListResultSchema, {
    status: "listed",
    projects: [
      {
        registration: "registered",
        projectId,
        name: "repository",
        repositoryBindingId: projectId,
        workspaceId: projectId,
        access: "not-assessed",
        repositoryLocation: { status: "present" },
        storage: { status: "healthy", storageId: projectId, generationId: projectId },
      },
    ],
    hiddenCount: 0,
  });
}

/**
 * A preload API whose registration answers each step with a default or a scripted result; a
 * list of results answers successive calls of that step in order.
 */
export function registrationApi(
  answers: Answers = {},
  choice: RepositoryChoiceResult = {
    status: "repository-selected",
    repositorySelectionId: ids.repositorySelectionId,
    directory: "C:\\work\\repository",
  },
  overrides: Partial<SlopStopApi> = {},
) {
  const calls: RendererRegistrationRequest[] = [];
  const queues = new Map(
    Object.entries(answers).map(([step, value]) => [
      step,
      Array.isArray(value) ? [...value] : [value],
    ]),
  );
  const registerProject = vi.fn(async (request: RendererRegistrationRequest) => {
    calls.push(request);
    const queue = queues.get(request.step);
    const scripted = queue !== undefined && queue.length > 1 ? queue.shift() : queue?.[0];
    return scripted ?? defaults[request.step];
  });
  let registered = false;
  const chooseRepository = vi.fn(async () => choice);
  const api = readyApi({
    chooseRepository,
    registerProject: async (request) => {
      const result = await registerProject(request);
      if (result.status === "registered") registered = true;
      return result;
    },
    listProjects: async () =>
      registered ? listedRepository() : { status: "listed", projects: [], hiddenCount: 0 },
    ...overrides,
  });
  return { api, calls, chooseRepository, steps: () => calls.map((call) => call.step) };
}
