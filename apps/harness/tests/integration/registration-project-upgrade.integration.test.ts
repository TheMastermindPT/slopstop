import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, it } from "vitest";
import { rewindToGenerationThree } from "./project-storage-upgrade-fixture.js";
import { registerFolder, registrationSession } from "./registration-flow-fixture.js";

/** The registered Project's active generation directory, read from the registry. */
function activeGenerationDirectory(root: string, projectId: string): string {
  const installation = path.join(root, "installation");
  const database = new DatabaseSync(path.join(installation, "application.db"), { readOnly: true });
  try {
    const row = database
      .prepare("SELECT active_generation_id FROM storage_registrations WHERE project_id = ?")
      .get(projectId);
    return path.join(installation, "projects", projectId, String(row?.["active_generation_id"]));
  } finally {
    database.close();
  }
}

/** Registers the session's repository through the real flow, then stops that runtime. */
async function registerThenStop() {
  const first = await registrationSession();
  try {
    const registration = await registerFolder(first, first.directory);
    if (registration.registered.status !== "registered") throw new Error("Registration missing");
    return { root: first.root, ...registration, projectId: registration.registered.projectId };
  } finally {
    await first.dispose();
  }
}

it.runIf(process.platform === "win32")(
  "keeps a registered Project usable after its upgrade",
  { timeout: 60_000 },
  async () => {
    const registration = await registerThenStop();
    const { root, projectId } = registration;
    await rewindToGenerationThree({
      generationDirectory: activeGenerationDirectory(root, projectId),
    });

    const session = await registrationSession({ root });
    try {
      expect(await session.upgrade(projectId)).toMatchObject({ status: "upgraded" });
      expect(await session.list()).toMatchObject({
        status: "listed",
        hiddenCount: 0,
        projects: [{ projectId, registration: "registered", storage: { status: "healthy" } }],
      });
      expect(await session.register(registration.confirmation)).toEqual(registration.registered);
      expect(await session.activate(projectId)).toMatchObject({
        status: "active",
        access: "read-write",
      });
    } finally {
      await session.dispose();
    }

    const reopened = await registrationSession({ root });
    try {
      const remove = { step: "remove-from-list", projectId } as const;
      expect(await reopened.register(remove)).toEqual({ status: "removed", projectId });
      expect(await reopened.list()).toEqual({ status: "listed", projects: [], hiddenCount: 1 });
      const again = await reopened.prepareFolder(reopened.directory, registration.git);
      expect(again.result).toEqual({ status: "restored-to-list", projectId, name: "repository" });
      expect(await reopened.list()).toMatchObject({
        status: "listed",
        hiddenCount: 0,
        projects: [{ projectId, registration: "registered" }],
      });
    } finally {
      await reopened.dispose();
    }
  },
);

const otherProjectId = "00000000-0000-4000-8000-0000000000e9";

/** Moves every Storage row of the Project to another Project, consistently, in the registry. */
function moveStorageToOtherProject(root: string, projectId: string): void {
  const database = new DatabaseSync(path.join(root, "installation", "application.db"), {
    enableForeignKeyConstraints: false,
  });
  try {
    for (const table of ["storage_registrations", "storage_generations", "storage_upgrades"]) {
      database
        .prepare(`UPDATE ${table} SET project_id = ? WHERE project_id = ?`)
        .run(otherProjectId, projectId);
    }
  } finally {
    database.close();
  }
}

it.runIf(process.platform === "win32")(
  "refuses an upgraded receipt whose Storage belongs to another Project",
  { timeout: 60_000 },
  async () => {
    const { root, projectId } = await registerThenStop();
    await rewindToGenerationThree({
      generationDirectory: activeGenerationDirectory(root, projectId),
    });
    const upgrader = await registrationSession({ root });
    try {
      expect(await upgrader.upgrade(projectId)).toMatchObject({ status: "upgraded" });
    } finally {
      await upgrader.dispose();
    }
    moveStorageToOtherProject(root, projectId);

    const session = await registrationSession({ root });
    expect(await session.list()).toEqual({ status: "broken", code: "REGISTRY_CORRUPT" });
    // Known follow-up (coordinator log): a broken listing leaves its cleanup unconfirmed at stop.
    await expect(session.dispose()).rejects.toThrow("Project listing cleanup is unconfirmed.");
  },
);
