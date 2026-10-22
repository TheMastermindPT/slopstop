import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";
import { MessageChannel } from "node:worker_threads";
import {
  CanonicalProjectActivationResultSchema,
  CanonicalProjectCommandRequestSchema,
  CanonicalProjectSwitchResultSchema,
  createProjectActivateCommand,
  createProjectCommand,
  createProjectSwitchCommand,
  decodeStrict,
  type ProjectId,
  RegisteredProjectSchema,
} from "@slopstop/protocol";
import { Schema } from "effect";
import { afterEach, expect, it } from "vitest";
import { startHarnessProcessRuntime } from "../../src/process-bootstrap.js";
import { createProjectRegistrationOwner } from "../../src/registration/project-registration-owner.js";
import { RepositoryTrustDecisionSchema } from "../../src/registration/repository-trust.js";
import {
  parseProjectStorageManifest,
  serializeProjectStorageManifest,
} from "../../src/storage/project-storage-manifest.js";
import { silentHarnessLogger, transportFor } from "./project-storage-runtime-fixture.js";
import {
  consentRegistryOptions,
  createControlledIdentityConsent,
} from "./registration-consent-fixture.js";
import { confirmationRequest, installedGit } from "./registration-git-fixture.js";
import { missing94 } from "./trace-94.js";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

async function runtime(options: ReturnType<typeof consentRegistryOptions>) {
  const { port1, port2 } = new MessageChannel();
  const stop = await startHarnessProcessRuntime({
    logger: silentHarnessLogger,
    bootstrap: {
      kind: "harness.connect",
      applicationStorageRootUrl: pathToFileURL(options.applicationStorageRoot).href,
      migrationResourcesRootUrl: pathToFileURL(options.migrationResourcesRoot).href,
    },
    transport: transportFor(port1),
  });
  return {
    send: (message: unknown) =>
      new Promise<unknown>((resolve) => {
        port2.once("message", resolve);
        port2.postMessage(message);
      }),
    stop: async () => {
      try {
        await stop();
      } finally {
        port1.close();
        port2.close();
      }
    },
  };
}

async function activate(host: Awaited<ReturnType<typeof runtime>>, projectId: ProjectId) {
  const response = await host.send(
    createProjectActivateCommand(
      { messageId: randomUUID(), sentAt: new Date().toISOString() },
      { projectId },
    ),
  );
  return Schema.decodeUnknownSync(
    Schema.Struct({
      event: Schema.Literal("project.activate.result"),
      payload: CanonicalProjectActivationResultSchema,
    }),
  )(response).payload;
}

type Activation = Awaited<ReturnType<typeof activate>>;

/** Answers `activation` when it is active, or throws `label` with the actual result. */
function requireActive(activation: Activation, label: string) {
  if (activation.status !== "active") throw missing94(label, activation);
  return activation;
}

/** Switches `host` from its active Project to `projectId` and answers the switch result. */
async function switchProject(
  host: Awaited<ReturnType<typeof runtime>>,
  from: Parameters<typeof createProjectSwitchCommand>[1]["from"],
  projectId: ProjectId,
) {
  const response = await host.send(
    createProjectSwitchCommand(
      { messageId: randomUUID(), sentAt: new Date().toISOString() },
      { from, to: { projectId } },
    ),
  );
  return Schema.decodeUnknownSync(
    Schema.Struct({
      event: Schema.Literal("project.switch.result"),
      payload: CanonicalProjectSwitchResultSchema,
    }),
  )(response).payload;
}

/** The selection test command for `projectId` under `activationId`. */
function testCommand(projectId: ProjectId, activationId: string) {
  return decodeStrict(CanonicalProjectCommandRequestSchema, {
    projectId,
    activationId,
    command: {
      commandId: randomUUID(),
      type: "selection.test-command",
      version: 1,
      payload: {},
    },
  });
}

/** Sends one Project command through `host` and answers its raw response. */
function sendCommand(
  host: Awaited<ReturnType<typeof runtime>>,
  request: ReturnType<typeof testCommand>,
) {
  return host.send(
    createProjectCommand({ messageId: randomUUID(), sentAt: new Date().toISOString() }, request),
  );
}

function rows(f: Awaited<ReturnType<typeof registeredFixture>>, sql: string) {
  const database = new DatabaseSync(path.join(f.options.applicationStorageRoot, "application.db"));
  try {
    return database.prepare(sql).all();
  } finally {
    database.close();
  }
}

type RegisteredFixture = Awaited<ReturnType<typeof registeredFixture>>;

/** The registered generation's canonical database. */
function canonicalDatabasePath(f: RegisteredFixture) {
  return path.join(
    f.options.applicationStorageRoot,
    "projects",
    f.registered.projectId,
    f.registered.generationId,
    "slopstop.db",
  );
}

/** No writer generation was ever acquired in the registered canonical database. */
function expectNoWriterGeneration(f: RegisteredFixture) {
  const canonical = new DatabaseSync(canonicalDatabasePath(f));
  try {
    expect(canonical.prepare("SELECT count(*) AS total FROM writer_generations").get()).toEqual({
      total: 0,
    });
  } finally {
    canonical.close();
  }
}

/** A fresh repository replacing the registered one is refused without Storage changes. */
async function expectIdentityChangeRefused(f: RegisteredFixture, displace: () => Promise<void>) {
  const before = rows(f, "SELECT * FROM storage_generations");
  await displace();
  execFileSync(installedGit, ["init", "--quiet", f.directory]);
  const host = await runtime(f.options);
  try {
    expect(await activate(host, f.registered.projectId)).toMatchObject({
      status: "rejected",
      diagnostic: { code: "REPOSITORY_IDENTITY_CHANGED" },
    });
    expect(rows(f, "SELECT * FROM storage_generations")).toEqual(before);
  } finally {
    await host.stop();
  }
}

/**
 * Registers `count` fresh repositories through one registry session: one executable consent,
 * then each repository's own selection, trust, preparation and confirmation.
 */
async function registeredProjects(count: number) {
  const root = await mkdtemp(path.join(tmpdir(), "opencode/pc-s1-select-"));
  roots.push(root);
  const directories = Array.from({ length: count }, (_, index) =>
    path.join(root, index === 0 ? "repository" : `repository-${randomUUID()}`),
  );
  for (const directory of directories) execFileSync(installedGit, ["init", "--quiet", directory]);
  let next = 0;
  const scenario = await createControlledIdentityConsent(
    root,
    { select: async () => ({ status: "selected", directory: directories[next++] ?? root }) },
    installedGit,
  );
  const options = { ...consentRegistryOptions(root), applicationVersion: "0.0.0" };
  const owner = createProjectRegistrationOwner(scenario.registry, options, root);
  try {
    await scenario.registry.decideIdentityQueries({ ...scenario.request, decision: "accepted" });
    const projects = [];
    for (const directory of directories) {
      const selected = await scenario.registry.selectRepository();
      if (selected.status !== "prepared") throw missing94("Selection missing", selected);
      const trust = {
        repositorySelectionId: selected.repositorySelectionId,
        trustId: randomUUID(),
      };
      await scenario.registry.decideRepositoryTrust(
        decodeStrict(RepositoryTrustDecisionSchema, { ...trust, decision: "accepted" }),
      );
      const preparation = {
        version: 1,
        requestId: randomUUID(),
        admission: { ...scenario.request, ...trust },
      };
      const proposal = await owner.prepare(preparation);
      if (proposal.status !== "prepared") throw missing94("Preparation missing", proposal);
      const registered = decodeStrict(
        RegisteredProjectSchema,
        await owner.confirm(confirmationRequest(preparation, proposal)),
      );
      projects.push({ root, directory, options, registered });
    }
    return projects;
  } finally {
    await owner.close();
    await scenario.observer.close();
    await scenario.registry.stop();
  }
}

async function registeredPair() {
  const [a, b] = await registeredProjects(2);
  if (a === undefined || b === undefined) throw new Error("Registered Projects missing");
  return [a, b] as const;
}

async function registeredFixture() {
  const [project] = await registeredProjects(1);
  if (project === undefined) throw new Error("Registered Project missing");
  return project;
}

it.runIf(process.platform === "win32")(
  "runtime switches between two registered Projects and releases the old writer without creating Storage",
  async () => {
    const [a, b] = await registeredPair();
    expect(b.registered.projectId).not.toBe(a.registered.projectId);
    const before = rows(a, "SELECT * FROM storage_generations ORDER BY project_id");
    expect(before).toHaveLength(2);
    const host = await runtime(a.options);
    const reopened = await runtime(a.options);
    try {
      const activeA = requireActive(
        await activate(host, a.registered.projectId),
        "Activation A missing",
      );
      expect(activeA.access).toBe("read-write");
      const switched = await switchProject(
        host,
        { projectId: a.registered.projectId, activationId: activeA.activationId },
        b.registered.projectId,
      );
      if (switched.status !== "target-result" || switched.target.status !== "active")
        throw missing94("Activation B missing", switched);
      expect(switched.target).toMatchObject({
        access: "read-write",
        request: { projectId: b.registered.projectId },
      });
      expect(switched.target.activationId).not.toBe(activeA.activationId);
      const oldCommand = testCommand(a.registered.projectId, activeA.activationId);
      expect(await sendCommand(host, oldCommand)).toMatchObject({
        event: "project.command.result",
        payload: { status: "project-mismatch", diagnostic: { code: "PROJECT_NOT_ACTIVE" } },
      });
      // A's native lease must be released even while the first runtime still owns B.
      const reopenedA = requireActive(
        await activate(reopened, a.registered.projectId),
        "Reopened A missing",
      );
      expect(reopenedA.access).toBe("read-write");
      expect(reopenedA.activationId).not.toBe(activeA.activationId);
      expect(await sendCommand(reopened, oldCommand)).toMatchObject({
        payload: { status: "stale-activation", diagnostic: { code: "PROJECT_ACTIVATION_STALE" } },
      });
      expect(rows(a, "SELECT * FROM storage_generations ORDER BY project_id")).toEqual(before);
    } finally {
      await reopened.stop();
      await host.stop();
    }
  },
);

it.runIf(process.platform === "win32")(
  "runtime refuses a missing registered repository before acquiring a writer",
  async () => {
    const f = await registeredFixture();
    await rm(f.directory, { recursive: true });
    const host = await runtime(f.options);
    try {
      expect(
        await host.send(
          createProjectActivateCommand(
            { messageId: randomUUID(), sentAt: new Date().toISOString() },
            { projectId: f.registered.projectId },
          ),
        ),
      ).toMatchObject({
        event: "project.activate.result",
        payload: { status: "rejected", diagnostic: { code: "REPOSITORY_NOT_FOUND" } },
      });
      expectNoWriterGeneration(f);
    } finally {
      await host.stop();
    }
  },
);

it.runIf(process.platform === "win32")(
  "runtime refuses a canonical binding that disagrees with its registration",
  async () => {
    const f = await registeredFixture();
    const canonical = new DatabaseSync(canonicalDatabasePath(f));
    try {
      canonical
        .prepare("UPDATE repository_bindings SET registration_request_id = ?")
        .run(randomUUID());
    } finally {
      canonical.close();
    }
    const host = await runtime(f.options);
    try {
      expect(await activate(host, f.registered.projectId)).toMatchObject({
        status: "broken",
        diagnostic: { code: "PROJECT_STORAGE_BROKEN" },
      });
    } finally {
      await host.stop();
    }
  },
);

it.runIf(process.platform === "win32")(
  "runtime rejects replacement of the registered root without writer or Storage changes",
  async () => {
    const f = await registeredFixture();
    await expectIdentityChangeRefused(f, () => rename(f.directory, `${f.directory}-preserved`));
    expectNoWriterGeneration(f);
  },
);

it.runIf(process.platform === "win32")(
  "runtime refuses changed Git administration without changing Project Storage",
  async () => {
    const f = await registeredFixture();
    await expectIdentityChangeRefused(f, () =>
      rename(path.join(f.directory, ".git"), path.join(f.directory, ".git-old")),
    );
  },
);

it.runIf(process.platform === "win32")(
  "runtime preserves an older registered generation in migration-required safe mode",
  async () => {
    const f = await registeredFixture();
    const generation = path.join(
      f.options.applicationStorageRoot,
      "projects",
      f.registered.projectId,
      f.registered.generationId,
    );
    const canonicalPath = path.join(generation, "slopstop.db");
    const manifestPath = path.join(generation, "manifest.json");
    const canonical = new DatabaseSync(canonicalPath);
    try {
      canonical.exec(
        "DROP TABLE project_workspaces; DROP TABLE repository_bindings; UPDATE schema_metadata SET schema_version = 2, last_migration_id = '0001_canonical_project_writer'",
      );
    } finally {
      canonical.close();
    }
    const before = await readFile(canonicalPath);
    const manifest = parseProjectStorageManifest(await readFile(manifestPath, "utf8"));
    await writeFile(
      manifestPath,
      serializeProjectStorageManifest({
        ...manifest,
        canonical: {
          ...manifest.canonical,
          schemaVersion: 2,
          lastMigrationId: "0001_canonical_project_writer",
          activationBaseline: {
            algorithm: "sha256",
            sizeBytes: before.length,
            sha256: createHash("sha256").update(before).digest("hex"),
          },
        },
      }),
    );
    const beforeManifest = await readFile(manifestPath);
    const host = await runtime(f.options);
    try {
      expect(await activate(host, f.registered.projectId)).toMatchObject({
        status: "safe-mode",
        identity: { storageId: f.registered.storageId, generationId: f.registered.generationId },
        canonicalHealth: { status: "migration-required" },
      });
      expect(await readFile(canonicalPath)).toEqual(before);
      expect(await readFile(manifestPath)).toEqual(beforeManifest);
    } finally {
      await host.stop();
    }
  },
);

it.runIf(process.platform === "win32")(
  "runtime reopens the same registered generation in a new session without Git or creation",
  async () => {
    const f = await registeredFixture();
    const before = rows(f, "SELECT * FROM storage_generations");
    const observations = rows(
      f,
      "SELECT * FROM registration_identity_query_attempts ORDER BY observation_id",
    );
    const first = await runtime(f.options);
    let activation: Awaited<ReturnType<typeof activate>>;
    try {
      activation = await activate(first, f.registered.projectId);
      expect(activation).toMatchObject({
        status: "active",
        access: "read-write",
        request: { projectId: f.registered.projectId },
      });
    } finally {
      await first.stop();
    }
    const reopened = await runtime(f.options);
    try {
      const second = await activate(reopened, f.registered.projectId);
      expect(second).toMatchObject({ status: "active", access: "read-write" });
      if (activation.status !== "active" || second.status !== "active")
        throw missing94("Activation missing", { activation, second });
      expect(second.activationId).not.toBe(activation.activationId);
      expect(rows(f, "SELECT * FROM storage_generations")).toEqual(before);
      expect(
        rows(f, "SELECT * FROM registration_identity_query_attempts ORDER BY observation_id"),
      ).toEqual(observations);
    } finally {
      await reopened.stop();
    }
  },
);

it.runIf(process.platform === "win32")(
  "runtime preserves the old activation when the registered switch target disappears",
  async () => {
    const f = await registeredFixture();
    const host = await runtime(f.options);
    try {
      const active = await activate(host, f.registered.projectId);
      if (active.status !== "active") throw missing94("Activation missing", active);
      await rm(f.directory, { recursive: true });
      expect(
        await host.send(
          createProjectSwitchCommand(
            { messageId: randomUUID(), sentAt: new Date().toISOString() },
            {
              from: { projectId: f.registered.projectId, activationId: active.activationId },
              to: { projectId: f.registered.projectId },
            },
          ),
        ),
      ).toMatchObject({
        event: "project.switch.result",
        payload: {
          status: "target-result",
          sourceReleased: false,
          target: { status: "rejected", diagnostic: { code: "REPOSITORY_NOT_FOUND" } },
        },
      });
      expect(await activate(host, f.registered.projectId)).toMatchObject({
        status: "rejected",
        diagnostic: { code: "PROJECT_ALREADY_ACTIVE" },
      });
    } finally {
      await host.stop();
    }
  },
);

it.runIf(process.platform === "win32")(
  "runtime selects read-only when another session owns the writer and blocks commands",
  async () => {
    const f = await registeredFixture();
    const writer = await runtime(f.options);
    const reader = await runtime(f.options);
    try {
      expect(await activate(writer, f.registered.projectId)).toMatchObject({
        status: "active",
        access: "read-write",
      });
      const selected = await activate(reader, f.registered.projectId);
      expect(selected).toMatchObject({
        status: "active",
        access: "read-only",
        writerGeneration: null,
        diagnostic: { code: "WRITER_UNAVAILABLE" },
      });
      if (selected.status !== "active") throw missing94("Activation missing", selected);
      const command = testCommand(f.registered.projectId, selected.activationId);
      expect(await sendCommand(reader, command)).toMatchObject({
        event: "project.command.result",
        payload: { status: "read-only", diagnostic: { code: "WRITER_UNAVAILABLE" } },
      });
    } finally {
      await reader.stop();
      await writer.stop();
    }
  },
);
