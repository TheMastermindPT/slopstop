import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { lstat, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { createProjectRegistrationPreparation } from "../../src/registration/project-registration-preparation.js";
import { createRegistrationRegistry } from "../../src/registration/registration-registry.js";
import { createWindowsIdentityQueryChild } from "../../src/registration/windows-version-child.js";
import { createWorkerLocalLibsqlClient } from "../../src/storage/local-libsql-worker-client.js";
import {
  consentRegistryOptions,
  createControlledIdentityConsent,
} from "./registration-consent-fixture.js";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

async function editRegistry(options: ReturnType<typeof consentRegistryOptions>, sql: string) {
  const client = createWorkerLocalLibsqlClient(
    path.join(options.applicationStorageRoot, "application.db"),
    "application",
  );
  try {
    return await client.execute(sql);
  } finally {
    await client.close();
  }
}

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "opencode/pc-s1-preparation-"));
  roots.push(root);
  const directory = path.join(root, "repository");
  const git = path.join(process.env["ProgramFiles"] ?? "C:/Program Files", "Git/cmd/git.exe");
  execFileSync(git, ["init", "--quiet", directory]);
  const scenario = await createControlledIdentityConsent(
    root,
    {
      select: async () => ({ status: "selected", directory }),
    },
    git,
  );
  const options = consentRegistryOptions(root);
  let registry = scenario.registry;
  const native = createWindowsIdentityQueryChild(root);
  let dispatches = 0;
  let failQuery = false;
  const child = {
    run: async (...args: Parameters<typeof native.run>) => {
      dispatches += 1;
      const result = await native.run(...args);
      return failQuery && result.status === "exited" ? { ...result, exitCode: 128 } : result;
    },
  };
  let owner = createProjectRegistrationPreparation(registry, options, root, child);
  const selected = await registry.selectRepository();
  if (selected.status !== "prepared") throw new Error("Missing native selection");
  const trust = { repositorySelectionId: selected.repositorySelectionId, trustId: randomUUID() };
  expect(
    await registry.decideIdentityQueries({ ...scenario.request, decision: "accepted" }),
  ).toEqual({ status: "recorded" });
  // The public admission schema brands identifiers at the owner boundary.
  const { RepositoryTrustDecisionSchema } = await import(
    "../../src/registration/repository-trust.js"
  );
  expect(
    await registry.decideRepositoryTrust(
      RepositoryTrustDecisionSchema.parse({ ...trust, decision: "accepted" }),
    ),
  ).toEqual({ status: "recorded" });
  const request = {
    version: 1,
    requestId: randomUUID(),
    admission: { ...scenario.request, ...trust },
  };
  return {
    directory,
    options,
    request,
    prepare: (input: unknown = request) => owner.prepare(input),
    validateConfirmation: (input: unknown) => owner.validateConfirmation(input),
    confirm: (input: unknown) => owner.confirm(input),
    dispatches: () => dispatches,
    failQueries: () => {
      failQuery = true;
    },
    restart: async () => {
      await owner.close();
      await scenario.observer.close();
      await registry.stop();
      registry = createRegistrationRegistry(options);
      owner = createProjectRegistrationPreparation(registry, options, root, child);
    },
    close: async () => {
      await owner.close();
      await scenario.observer.close();
      await registry.stop();
    },
  };
}

it.runIf(process.platform === "win32" && process.arch === "x64")(
  "refuses confirmation after persisted executable consent loses its applicable selection",
  async () => {
    const f = await fixture();
    try {
      const proposal = await f.prepare();
      if (proposal.status !== "prepared") throw new Error("Preparation unavailable");
      expect(f.dispatches()).toBe(6);
      const otherSelectionId = randomUUID();
      // Controlled authority loss in fixture storage, not a production revocation API.
      expect(
        (
          await editRegistry(
            f.options,
            `INSERT INTO registration_executable_selections SELECT '${otherSelectionId}', executable_path, platform, volume_identity, file_identity, birth_identity, sha256, captured_at FROM registration_executable_selections WHERE selection_id = '${f.request.admission.selectionId}'`,
          )
        ).rowsAffected,
      ).toBe(1);
      expect(
        (
          await editRegistry(
            f.options,
            `UPDATE registration_identity_consents SET selection_id = '${otherSelectionId}' WHERE consent_id = '${f.request.admission.consentId}'`,
          )
        ).rowsAffected,
      ).toBe(1);
      expect((await editRegistry(f.options, "PRAGMA foreign_key_check")).rows).toEqual([]);
      const observations = (
        await editRegistry(
          f.options,
          "SELECT * FROM registration_identity_query_attempts ORDER BY observation_id",
        )
      ).rows;
      expect(
        await f.confirm({
          version: 1,
          requestId: randomUUID(),
          preparation: f.request,
          proposalId: proposal.proposalId,
          proposalFingerprint: proposal.proposalFingerprint,
        }),
      ).toEqual({ status: "unavailable", code: "GIT_CONFIRMATION_REQUIRED" });
      expect(f.dispatches()).toBe(6);
      expect(
        (
          await editRegistry(
            f.options,
            "SELECT * FROM registration_identity_query_attempts ORDER BY observation_id",
          )
        ).rows,
      ).toEqual(observations);
      expect(
        (await editRegistry(f.options, "SELECT * FROM registration_reservations")).rows,
      ).toEqual([]);
      expect((await editRegistry(f.options, "SELECT * FROM registration_requests")).rows).toEqual(
        [],
      );
    } finally {
      await f.close();
    }
  },
);

it.runIf(process.platform === "win32" && process.arch === "x64")(
  "reserves a durable confirmation once and replays its incomplete state after restart",
  async () => {
    const f = await fixture();
    try {
      const proposal = await f.prepare();
      if (proposal.status !== "prepared") throw new Error("Preparation unavailable");
      const request = {
        version: 1,
        requestId: randomUUID(),
        preparation: f.request,
        proposalId: proposal.proposalId,
        proposalFingerprint: proposal.proposalFingerprint,
      };
      const expected = {
        status: "pending-recovery",
        code: "REGISTRATION_INCOMPLETE",
        requestId: request.requestId,
      };
      expect(await f.confirm(request)).toEqual(expected);
      expect(f.dispatches()).toBe(12);
      const reservations = (
        await editRegistry(f.options, "SELECT * FROM registration_reservations")
      ).rows;
      const requests = (await editRegistry(f.options, "SELECT * FROM registration_requests")).rows;
      expect(reservations).toHaveLength(1);
      expect(requests).toHaveLength(1);
      expect(
        (await editRegistry(f.options, "SELECT count(*) FROM storage_generations")).rows,
      ).toEqual([[0]]);
      await f.restart();
      await rm(f.directory, { recursive: true });
      expect(await f.confirm(request)).toEqual(expected);
      expect(f.dispatches()).toBe(12);
      expect(
        (await editRegistry(f.options, "SELECT * FROM registration_reservations")).rows,
      ).toEqual(reservations);
      expect((await editRegistry(f.options, "SELECT * FROM registration_requests")).rows).toEqual(
        requests,
      );
    } finally {
      await f.close();
    }
  },
);

it.runIf(process.platform === "win32" && process.arch === "x64")(
  "rejects reuse of a durable confirmation request with changed inputs before Git",
  async () => {
    const f = await fixture();
    try {
      const proposal = await f.prepare();
      if (proposal.status !== "prepared") throw new Error("Preparation unavailable");
      const request = {
        version: 1,
        requestId: randomUUID(),
        preparation: f.request,
        proposalId: proposal.proposalId,
        proposalFingerprint: proposal.proposalFingerprint,
      };
      expect(await f.confirm(request)).toMatchObject({
        status: "pending-recovery",
        code: "REGISTRATION_INCOMPLETE",
      });
      const before = (await editRegistry(f.options, "SELECT * FROM registration_requests")).rows;
      await rm(f.directory, { recursive: true });
      expect(await f.confirm({ ...request, proposalFingerprint: "0".repeat(64) })).toEqual({
        status: "rejected",
        code: "REGISTRATION_IDEMPOTENCY_CONFLICT",
      });
      expect(f.dispatches()).toBe(12);
      expect((await editRegistry(f.options, "SELECT * FROM registration_requests")).rows).toEqual(
        before,
      );
    } finally {
      await f.close();
    }
  },
);

it.runIf(process.platform === "win32" && process.arch === "x64")(
  "reports corrupt durable reservation as broken before any new confirmation observation",
  async () => {
    const f = await fixture();
    try {
      const proposal = await f.prepare();
      if (proposal.status !== "prepared") throw new Error("Preparation unavailable");
      const request = {
        version: 1,
        requestId: randomUUID(),
        preparation: f.request,
        proposalId: proposal.proposalId,
        proposalFingerprint: proposal.proposalFingerprint,
      };
      expect(await f.confirm(request)).toMatchObject({
        status: "pending-recovery",
        code: "REGISTRATION_INCOMPLETE",
      });
      await f.restart();
      await editRegistry(
        f.options,
        "UPDATE registration_reservations SET record_fingerprint = 'corrupt'",
      );
      expect(await f.confirm(request)).toEqual({ status: "broken", code: "REGISTRY_CORRUPT" });
      expect(f.dispatches()).toBe(12);
      expect(
        (await editRegistry(f.options, "SELECT count(*) FROM registration_reservations")).rows,
      ).toEqual([[1]]);
    } finally {
      await f.close();
    }
  },
);

it.runIf(process.platform === "win32" && process.arch === "x64")(
  "validates confirmation with six fresh queries against the saved proposal after restart",
  async () => {
    const f = await fixture();
    try {
      const prepared = await f.prepare();
      if (prepared.status !== "prepared") throw new Error("Preparation unavailable");
      await f.restart();
      const request = {
        version: 1,
        requestId: randomUUID(),
        preparation: f.request,
        proposalId: prepared.proposalId,
        proposalFingerprint: prepared.proposalFingerprint,
      };
      expect(await f.validateConfirmation(request)).toEqual({
        status: "confirmation-validated",
        requestId: request.requestId,
        proposalId: prepared.proposalId,
        proposalFingerprint: prepared.proposalFingerprint,
      });
      expect(f.dispatches()).toBe(12);
      expect(
        (await editRegistry(f.options, "SELECT count(*) FROM registration_proposals")).rows,
      ).toEqual([[1]]);
      expect(
        (await editRegistry(f.options, "SELECT count(*) FROM storage_registrations")).rows,
      ).toEqual([[0]]);
    } finally {
      await f.close();
    }
  },
);

it.runIf(process.platform === "win32" && process.arch === "x64")(
  "refuses confirmation when fresh Git administration differs from the saved proposal",
  async () => {
    const f = await fixture();
    try {
      const prepared = await f.prepare();
      if (prepared.status !== "prepared") throw new Error("Preparation unavailable");
      const before = (await editRegistry(f.options, "SELECT * FROM registration_proposals")).rows;
      await rename(path.join(f.directory, ".git"), path.join(f.directory, ".git-preserved"));
      const git = path.join(process.env["ProgramFiles"] ?? "C:/Program Files", "Git/cmd/git.exe");
      execFileSync(git, ["init", "--quiet", f.directory]);
      expect(
        await f.confirm({
          version: 1,
          requestId: randomUUID(),
          preparation: f.request,
          proposalId: prepared.proposalId,
          proposalFingerprint: prepared.proposalFingerprint,
        }),
      ).toEqual({ status: "rejected", code: "REPOSITORY_IDENTITY_CHANGED" });
      expect(
        (await editRegistry(f.options, "SELECT count(*) FROM registration_reservations")).rows,
      ).toEqual([[0]]);
      expect(f.dispatches()).toBe(12);
      expect((await editRegistry(f.options, "SELECT * FROM registration_proposals")).rows).toEqual(
        before,
      );
      expect(
        (await editRegistry(f.options, "SELECT count(*) FROM storage_generations")).rows,
      ).toEqual([[0]]);
    } finally {
      await f.close();
    }
  },
);

it.runIf(process.platform === "win32" && process.arch === "x64")(
  "refuses confirmation of a missing target even when historical preparation still replays",
  async () => {
    const f = await fixture();
    try {
      const prepared = await f.prepare();
      if (prepared.status !== "prepared") throw new Error("Preparation unavailable");
      await f.restart();
      await rm(f.directory, { recursive: true });
      expect(await f.prepare()).toEqual(prepared);
      expect(
        await f.validateConfirmation({
          version: 1,
          requestId: randomUUID(),
          preparation: f.request,
          proposalId: prepared.proposalId,
          proposalFingerprint: prepared.proposalFingerprint,
        }),
      ).toEqual({ status: "rejected", code: "REPOSITORY_NOT_FOUND" });
      expect(f.dispatches()).toBe(6);
      expect(
        (await editRegistry(f.options, "SELECT count(*) FROM storage_generations")).rows,
      ).toEqual([[0]]);
    } finally {
      await f.close();
    }
  },
);

it
  .runIf(process.platform === "win32" && process.arch === "x64")
  .each(["proposalId", "proposalFingerprint"] as const)(
  "refuses confirmation with mismatched %s before any new observation",
  async (field) => {
    const f = await fixture();
    try {
      const prepared = await f.prepare();
      if (prepared.status !== "prepared") throw new Error("Preparation unavailable");
      const request = {
        version: 1,
        requestId: randomUUID(),
        preparation: f.request,
        proposalId: prepared.proposalId,
        proposalFingerprint: prepared.proposalFingerprint,
      };
      expect(
        await f.validateConfirmation({
          ...request,
          [field]: field === "proposalId" ? randomUUID() : "0".repeat(64),
        }),
      ).toEqual({ status: "rejected", code: "REGISTRATION_IDEMPOTENCY_CONFLICT" });
      expect(f.dispatches()).toBe(6);
      expect(
        (await editRegistry(f.options, "SELECT count(*) FROM storage_generations")).rows,
      ).toEqual([[0]]);
    } finally {
      await f.close();
    }
  },
);

it.runIf(process.platform === "win32" && process.arch === "x64")(
  "refuses missing registry replay without observing or recreating installation storage",
  async () => {
    const f = await fixture();
    try {
      expect((await f.prepare()).status).toBe("prepared");
      expect(f.dispatches()).toBe(6);
      await f.restart();
      const root = f.options.applicationStorageRoot;
      const savedDatabase = await readFile(path.join(root, "application.db"));
      const movedRoot = `${root}-preserved`;
      await rename(root, movedRoot);
      expect(await f.prepare()).toEqual({
        status: "pending-recovery",
        code: "REGISTRY_MISSING_WITH_WITNESS",
      });
      expect(f.dispatches()).toBe(6);
      await expect(lstat(root)).rejects.toMatchObject({ code: "ENOENT" });
      expect(await readFile(path.join(movedRoot, "application.db"))).toEqual(savedDatabase);
    } finally {
      await f.close();
    }
  },
);

it.runIf(process.platform === "win32" && process.arch === "x64")(
  "persists one prepared proposal and recovers its exact result after restart",
  async () => {
    const f = await fixture();
    try {
      const prepared = await f.prepare();
      expect(prepared).toMatchObject({
        status: "prepared",
        requestId: f.request.requestId,
        requiresFreshValidation: true,
      });
      expect(f.dispatches()).toBe(6);
      expect(JSON.stringify(prepared)).not.toContain(f.directory);
      await f.restart();
      expect(await f.prepare()).toEqual(prepared);
      expect(f.dispatches()).toBe(6);
    } finally {
      await f.close();
    }
  },
);

it
  .runIf(process.platform === "win32" && process.arch === "x64")
  .each([
    "UPDATE registration_proposals SET record_json = '{}'",
    "UPDATE registration_proposals SET proposal_fingerprint = 'corrupt'",
  ])("reports corrupt saved proposal as broken without a new observation: %s", async (sql) => {
  const f = await fixture();
  try {
    expect((await f.prepare()).status).toBe("prepared");
    await f.restart();
    await editRegistry(f.options, sql);
    expect(await f.prepare()).toEqual({ status: "broken", code: "REGISTRY_CORRUPT" });
    expect(f.dispatches()).toBe(6);
    expect(
      (await editRegistry(f.options, "SELECT count(*) FROM registration_proposals")).rows,
    ).toEqual([[1]]);
  } finally {
    await f.close();
  }
});

it.runIf(process.platform === "win32" && process.arch === "x64")(
  "recovers historical preparation before missing target, stale consent and unrelated cleanup checks",
  async () => {
    const f = await fixture();
    try {
      const original = await f.prepare();
      expect(original.status).toBe("prepared");
      await f.restart();
      await rm(f.directory, { recursive: true });
      await editRegistry(
        f.options,
        "UPDATE registration_identity_consents SET decision = 'declined'",
      );
      await editRegistry(
        f.options,
        `INSERT INTO registration_identity_query_attempts (observation_id, repository_selection_id, consent_id, query_kind, scope_json, created_at) SELECT '${randomUUID()}', repository_selection_id, consent_id, query_kind, scope_json, created_at FROM registration_identity_query_attempts LIMIT 1`,
      );
      const before = await editRegistry(
        f.options,
        "SELECT * FROM registration_identity_query_attempts ORDER BY observation_id",
      );
      expect(await f.prepare()).toEqual(original);
      expect(
        (
          await editRegistry(
            f.options,
            "SELECT * FROM registration_identity_query_attempts ORDER BY observation_id",
          )
        ).rows,
      ).toEqual(before.rows);
      expect(f.dispatches()).toBe(6);
      expect(
        (await editRegistry(f.options, "SELECT count(*) FROM registration_proposals")).rows,
      ).toEqual([[1]]);
    } finally {
      await f.close();
    }
  },
);

it.runIf(process.platform === "win32" && process.arch === "x64")(
  "observes each new request freshly and saves no proposal for a missing repository",
  async () => {
    const f = await fixture();
    try {
      const first = await f.prepare();
      const second = await f.prepare({ ...f.request, requestId: randomUUID() });
      expect(first.status).toBe("prepared");
      expect(second.status).toBe("prepared");
      expect(second).not.toEqual(first);
      expect(f.dispatches()).toBe(12);
      await rm(f.directory, { recursive: true });
      expect(await f.prepare({ ...f.request, requestId: randomUUID() })).toEqual({
        status: "rejected",
        code: "REPOSITORY_NOT_FOUND",
      });
      expect(f.dispatches()).toBe(12);
      expect(
        (await editRegistry(f.options, "SELECT count(*) FROM registration_proposals")).rows,
      ).toEqual([[2]]);
      expect(
        (await editRegistry(f.options, "SELECT count(*) FROM storage_registrations")).rows,
      ).toEqual([[0]]);
    } finally {
      await f.close();
    }
  },
);

it.runIf(process.platform === "win32" && process.arch === "x64")(
  "preserves nonzero query failure without fabricating a prepared proposal",
  async () => {
    const f = await fixture();
    try {
      f.failQueries();
      expect(await f.prepare()).toEqual({
        status: "unavailable",
        code: "GIT_QUERY_FAILED",
        exitCode: 128,
      });
      expect(f.dispatches()).toBe(1);
      expect(
        (await editRegistry(f.options, "SELECT count(*) FROM registration_proposals")).rows,
      ).toEqual([[0]]);
    } finally {
      await f.close();
    }
  },
);

it.runIf(process.platform === "win32" && process.arch === "x64")(
  "rejects changed preparation inputs without observing or overwriting the original proposal",
  async () => {
    const f = await fixture();
    try {
      const original = await f.prepare();
      expect(original.status).toBe("prepared");
      await f.restart();
      await rm(f.directory, { recursive: true });
      expect(
        await f.prepare({
          ...f.request,
          admission: { ...f.request.admission, consentId: randomUUID() },
        }),
      ).toEqual({ status: "rejected", code: "REGISTRATION_IDEMPOTENCY_CONFLICT" });
      expect(await f.prepare()).toEqual(original);
      expect(f.dispatches()).toBe(6);
    } finally {
      await f.close();
    }
  },
);
