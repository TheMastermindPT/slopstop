import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { expect } from "vitest";
import {
  createProjectRegistrationObserver,
  GitVersionInspectionRequestSchema,
  PreparedGitVersionSchema,
} from "../../src/project-registration-observer.js";
import { createGitVersionInspection } from "../../src/registration/git-version-inspection.js";
import { IdentityQueryConsentRequestSchema } from "../../src/registration/identity-query-consent.js";
import { createRegistrationRegistry } from "../../src/registration/registration-registry.js";
import {
  type NativeRepositorySelectionPort,
  RepositoryTrustRequestSchema,
} from "../../src/registration/repository-trust.js";
import {
  createVersionObservationExecution,
  type GitVersionChildPort,
} from "../../src/registration/version-observation-execution.js";
import { observeSelectedExecutable } from "../../src/storage/repository-identity-observer.js";

export function consentRegistryOptions(root: string) {
  return {
    applicationStorageRoot: path.join(root, "installation"),
    migrationResourcesRoot: path.resolve(import.meta.dirname, "../../drizzle"),
  };
}

// Controlled child output, real durable journal and physical executable identity.
// This fixture does not prove native Git version execution.
function controlledVersionChild() {
  let dispatches = 0;
  const child: GitVersionChildPort = {
    run: async (dispatch) => {
      dispatches += 1;
      await dispatch.onOwned({
        platform: "win32",
        processId: 1234,
        creationTime100ns: "134000000000000000",
        jobName: `Local\\SlopStop.Registration.Observer.${dispatch.observationId}`,
      });
      return {
        status: "exited",
        exitCode: 0,
        stdout: new TextEncoder().encode("git version 2.53.0.windows.1\n"),
        stderr: new Uint8Array(),
      };
    },
  };
  return { child, versionDispatches: () => dispatches };
}

async function consentToVersion(
  registry: ReturnType<typeof createRegistrationRegistry>,
  executablePath: string,
) {
  const stageOne = GitVersionInspectionRequestSchema.parse({
    selectionId: "5f3920cf-4591-4f48-b0e8-4989a67e01f9",
    consentId: "390b0210-44f9-4c09-8a9b-765bb58d27c6",
  });
  if (stageOne.consentId === null) throw new Error("Test version consent missing");
  expect(
    await registry.prepareExecutable({ selectionId: stageOne.selectionId, executablePath }),
  ).toEqual({ status: "prepared", selectionId: stageOne.selectionId });
  expect(
    await registry.decideVersion({
      ...stageOne,
      consentId: stageOne.consentId,
      decision: "accepted",
    }),
  ).toEqual({ status: "recorded" });
  return stageOne;
}

export async function createControlledIdentityConsent(
  root: string,
  selection?: NativeRepositorySelectionPort,
) {
  const executablePath = path.join(root, "selected.exe");
  await copyFile(process.execPath, executablePath);
  const registry = createRegistrationRegistry(consentRegistryOptions(root), selection);
  const controlled = controlledVersionChild();
  const observer = createProjectRegistrationObserver(
    createGitVersionInspection(
      registry,
      createVersionObservationExecution({
        inspectIdentity: observeSelectedExecutable,
        journal: registry,
        child: controlled.child,
      }),
    ),
    registry,
  );
  try {
    const stageOne = await consentToVersion(registry, executablePath);
    const version = PreparedGitVersionSchema.parse(await observer.inspectGitVersion(stageOne));
    const request = IdentityQueryConsentRequestSchema.parse({
      selectionId: version.selectionId,
      observationId: version.observationId,
      consentId: "27959be2-c4a4-4d80-aec3-84bc7ab22eca",
    });
    return { registry, observer, stageOne, request, executablePath, ...controlled };
  } catch (error) {
    await observer.close();
    await registry.stop();
    throw error;
  }
}

export async function createRepositoryTrustScenario(root: string) {
  const directory = path.join(root, "repository");
  await mkdir(directory);
  const scenario = await createControlledIdentityConsent(root, {
    select: async () => ({ status: "selected", directory }),
  });
  try {
    expect(
      await scenario.registry.decideIdentityQueries({ ...scenario.request, decision: "accepted" }),
    ).toEqual({ status: "recorded" });
    const selected = await scenario.registry.selectRepository();
    if (selected.status !== "prepared") throw new Error("Native test selection unavailable");
    const trust = RepositoryTrustRequestSchema.parse({
      repositorySelectionId: selected.repositorySelectionId,
      trustId: "8f9f3180-fac6-40b7-999b-099cd6b96055",
    });
    return { ...scenario, directory, trust, admission: { ...scenario.request, ...trust } };
  } catch (error) {
    await scenario.observer.close();
    await scenario.registry.stop();
    throw error;
  }
}
