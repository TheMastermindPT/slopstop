import { copyFile, rename } from "node:fs/promises";
import path from "node:path";
import { expect, it } from "vitest";
import { PreparedGitVersionSchema } from "../../src/project-registration-observer.js";
import { IdentityQueryConsentRequestSchema } from "../../src/registration/identity-query-consent.js";
import { createRegistrationRegistry } from "../../src/registration/registration-registry.js";
import { createWindowsVersionChild } from "../../src/registration/windows-version-child.js";
import { createWorkerLocalLibsqlClient } from "../../src/storage/local-libsql-worker-client.js";
import { createControlledIdentityConsent } from "./registration-consent-fixture.js";
import {
  pinDecisionTimestamp,
  preservedDecisionTimestamp,
  readDecisionRows,
} from "./registration-decision-oracle.js";
import { createRegistryVersionScenario } from "./registration-version-fixture.js";

const recorded = { status: "recorded" };
const confirmationRequired = { status: "unavailable", code: "GIT_CONFIRMATION_REQUIRED" };
const conflict = { status: "rejected", code: "REGISTRATION_IDEMPOTENCY_CONFLICT" };

function reopenRegistry(root: string) {
  return createRegistrationRegistry({
    applicationStorageRoot: root,
    migrationResourcesRoot: path.resolve(import.meta.dirname, "../../drizzle"),
  });
}

async function changeStoredVersion(root: string, field: string, observationId: string) {
  const database = createWorkerLocalLibsqlClient(
    path.join(root, "installation/application.db"),
    "application",
  );
  try {
    await database.execute({
      sql: "UPDATE registration_observer_outcomes SET result_json = json_set(result_json, ?, ?) WHERE observation_id = ?",
      args: [field, "90d58381-7b05-4888-a731-74b3b04029ac", observationId],
    });
  } finally {
    await database.close();
  }
}

export function defineIdentityConsentCases(createRoot: (prefix: string) => Promise<string>) {
  it.each(["$.observationId", "$.selectionId", "$.unexpectedField"])(
    "refuses identity-query authority with corrupt persisted version %s",
    async (field) => {
      const root = await createRoot("pc-s1-stage2-corrupt-");
      const scenario = await createControlledIdentityConsent(root);
      try {
        const decision = { ...scenario.request, decision: "accepted" as const };
        expect(await scenario.registry.decideIdentityQueries(decision)).toEqual(recorded);
        await changeStoredVersion(root, field, scenario.request.observationId);
        expect(await scenario.registry.resolveIdentityQueries(scenario.request)).toEqual({
          status: "broken",
          code: "REGISTRY_CORRUPT",
        });
      } finally {
        await scenario.observer.close();
        await scenario.registry.stop();
      }
    },
  );

  it("invalidates identity-query and version grants when the physical executable is replaced", async () => {
    const scenario = await createControlledIdentityConsent(
      await createRoot("pc-s1-executable-replaced-"),
    );
    try {
      const decision = { ...scenario.request, decision: "accepted" as const };
      expect(await scenario.registry.decideIdentityQueries(decision)).toEqual(recorded);
      expect((await scenario.registry.resolveIdentityQueries(scenario.request)).status).toBe(
        "authorized",
      );
      await rename(scenario.executablePath, `${scenario.executablePath}.old`);
      await copyFile(process.execPath, scenario.executablePath);
      expect(await scenario.registry.resolveIdentityQueries(scenario.request)).toEqual(
        confirmationRequired,
      );
      expect(await scenario.observer.inspectGitVersion(scenario.stageOne)).toEqual(
        confirmationRequired,
      );
      expect(scenario.versionDispatches()).toBe(1);
    } finally {
      await scenario.observer.close();
      await scenario.registry.stop();
    }
  });

  it("retains an explicit identity-query refusal as cancellation after restart", async () => {
    const root = await createRoot("pc-s1-stage2-decline-");
    const scenario = await createRegistryVersionScenario(root, createWindowsVersionChild(root));
    const version = PreparedGitVersionSchema.parse(
      await scenario.observer.inspectGitVersion(scenario.request),
    );
    const request = IdentityQueryConsentRequestSchema.parse({
      selectionId: version.selectionId,
      observationId: version.observationId,
      consentId: "6ec89261-8044-4fe9-a60d-6d0c82a6a723",
    });
    try {
      expect(
        await scenario.registry.decideIdentityQueries({ ...request, decision: "declined" }),
      ).toEqual(recorded);
    } finally {
      await scenario.observer.close();
      await scenario.registry.stop();
    }
    const reopened = reopenRegistry(root);
    try {
      expect(await reopened.resolveIdentityQueries(request)).toEqual({ status: "cancelled" });
      expect(await reopened.decideIdentityQueries({ ...request, decision: "accepted" })).toEqual(
        conflict,
      );
      expect(await reopened.resolveIdentityQueries(request)).toEqual({ status: "cancelled" });
    } finally {
      await reopened.stop();
    }
  });

  it("replays an identity-query decision and refuses a conflicting decision without overwriting it", async () => {
    const root = await createRoot("pc-s1-stage2-replay-");
    const scenario = await createRegistryVersionScenario(root, createWindowsVersionChild(root));
    const table = "registration_identity_consents";
    let before: ReturnType<typeof readDecisionRows>;
    let request: ReturnType<typeof IdentityQueryConsentRequestSchema.parse>;
    try {
      const version = PreparedGitVersionSchema.parse(
        await scenario.observer.inspectGitVersion(scenario.request),
      );
      request = IdentityQueryConsentRequestSchema.parse({
        selectionId: version.selectionId,
        observationId: version.observationId,
        consentId: "232c0a25-7f9a-41e1-8fce-a22c02effa45",
      });
      const decision = { ...request, decision: "accepted" as const };
      expect(await scenario.registry.decideIdentityQueries(decision)).toEqual(recorded);
      before = pinDecisionTimestamp(root, table);
      expect(before).toEqual([
        {
          consent_id: request.consentId,
          selection_id: request.selectionId,
          observation_id: request.observationId,
          decision: "accepted",
          decided_at: preservedDecisionTimestamp,
        },
      ]);
      expect(await scenario.registry.decideIdentityQueries(decision)).toEqual(recorded);
      expect(readDecisionRows(root, table)).toEqual(before);
      expect(
        await scenario.registry.decideIdentityQueries({ ...request, decision: "declined" }),
      ).toEqual(conflict);
      expect(readDecisionRows(root, table)).toEqual(before);
      expect((await scenario.registry.resolveIdentityQueries(request)).status).toBe("authorized");
      expect(readDecisionRows(root, table)).toEqual(before);
    } finally {
      await scenario.observer.close();
      await scenario.registry.stop();
    }
    const reopened = reopenRegistry(root);
    try {
      expect(readDecisionRows(root, table)).toEqual(before);
      expect(await reopened.decideIdentityQueries({ ...request, decision: "accepted" })).toEqual(
        recorded,
      );
      expect(readDecisionRows(root, table)).toEqual(before);
      expect(await reopened.decideIdentityQueries({ ...request, decision: "declined" })).toEqual(
        conflict,
      );
      expect(readDecisionRows(root, table)).toEqual(before);
      expect((await reopened.resolveIdentityQueries(request)).status).toBe("authorized");
      expect(readDecisionRows(root, table)).toEqual(before);
    } finally {
      await reopened.stop();
    }
  });

  it("persists separate identity-query consent after real version observation and restart", async () => {
    const root = await createRoot("pc-s1-stage2-");
    const scenario = await createRegistryVersionScenario(root, createWindowsVersionChild(root));
    const version = PreparedGitVersionSchema.parse(
      await scenario.observer.inspectGitVersion(scenario.request),
    );
    const request = IdentityQueryConsentRequestSchema.parse({
      selectionId: version.selectionId,
      observationId: version.observationId,
      consentId: "2ecbf5a1-ac3e-478e-b7f7-3e9b15924ae3",
    });
    try {
      expect(await scenario.registry.resolveIdentityQueries(request)).toEqual(confirmationRequired);
      expect(
        await scenario.registry.decideIdentityQueries({ ...request, decision: "accepted" }),
      ).toEqual(recorded);
    } finally {
      await scenario.observer.close();
      await scenario.registry.stop();
    }
    const reopened = reopenRegistry(root);
    try {
      const authority = await reopened.resolveIdentityQueries(request);
      expect(authority.status).toBe("authorized");
      if (authority.status !== "authorized") throw new Error("Identity consent unavailable");
      expect(authority.version).toBe(version.version);
      expect(authority.executablePath).toBe(
        path.join(process.env["ProgramFiles"] ?? "C:/Program Files", "Git/cmd/git.exe"),
      );
    } finally {
      await reopened.stop();
    }
  });
}
