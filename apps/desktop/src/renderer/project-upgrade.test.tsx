import {
  type CanonicalProjectActivationResult,
  CanonicalProjectActivationResultSchema,
  type CanonicalProjectSwitchResult,
  CanonicalProjectSwitchResultSchema,
  decodeStrict,
  type HarnessStatus,
  type ProjectDatabaseHealth,
  type ProjectListResult,
  ProjectListResultSchema,
  ProjectUpgradeRequestSchema,
  type ProjectUpgradeResult,
  ProjectUpgradeResultSchema,
  projectUpgradeDiagnostics,
} from "@slopstop/protocol";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { upgradeResultForRow } from "../shared/upgrade-result-fixtures.js";
import { App } from "./app.js";
import { exposeApi, readyApi, readyStatus } from "./test-api.js";

const olderId = "00000000-0000-4000-8000-000000000010";
const otherId = "11111111-1111-4111-8111-111111111111";
const olderRequest = decodeStrict(ProjectUpgradeRequestSchema, { projectId: olderId });
const openOlder = "Open Project without a repository 00000000";
const olderHeading = "Project without a repository 00000000";

const healthy = { status: "healthy" } as const;
const migrationRequired = {
  status: "migration-required",
  diagnostic: { code: "DATABASE_MIGRATION_REQUIRED", message: "Migration required." },
} as const;
const recoveryRequired = {
  status: "recovery-required",
  diagnostic: { code: "DATABASE_RECOVERY_REQUIRED", message: "Recovery required." },
} as const;

const registeredOther = {
  registration: "registered",
  projectId: otherId,
  name: "repo-a",
  repositoryBindingId: otherId,
  workspaceId: otherId,
  access: "not-assessed",
  repositoryLocation: { status: "present" },
  storage: { status: "healthy", storageId: otherId, generationId: otherId },
} as const;

function listed(canonical: string, runtime: string, withOther = false): ProjectListResult {
  return decodeStrict(ProjectListResultSchema, {
    status: "listed",
    projects: [
      ...(withOther ? [registeredOther] : []),
      {
        registration: "unbound",
        projectId: olderId,
        access: "not-assessed",
        repositoryLocation: { status: "not-bound" },
        storage: {
          status: "safe-mode",
          storageId: olderId,
          generationId: olderId,
          canonical,
          runtime,
        },
      },
    ],
    hiddenCount: 0,
  });
}

function safeMode(
  projectId: string,
  canonical: ProjectDatabaseHealth,
  runtime: ProjectDatabaseHealth = healthy,
): CanonicalProjectActivationResult {
  return decodeStrict(CanonicalProjectActivationResultSchema, {
    status: "safe-mode",
    request: { projectId },
    identity: {
      storageId: null,
      generationId: null,
      canonicalDatabaseLineageId: null,
      runtimeDatabaseLineageId: null,
    },
    canonicalHealth: canonical,
    runtimeHealth: runtime,
  });
}

function active(projectId: string): CanonicalProjectActivationResult {
  return decodeStrict(CanonicalProjectActivationResultSchema, {
    status: "active",
    request: { projectId },
    access: "read-write",
    activationId: projectId,
    writerGeneration: 1,
  });
}

const upgraded = decodeStrict(ProjectUpgradeResultSchema, {
  status: "upgraded",
  request: olderRequest,
  sourceGenerationId: "22222222-2222-4222-8222-222222222222",
  generationId: "33333333-3333-4333-8333-333333333333",
  upgradeId: "44444444-4444-4444-8444-444444444444",
});
const notRequired = decodeStrict(ProjectUpgradeResultSchema, {
  status: "not-required",
  request: olderRequest,
});

type Gate<Value> = Readonly<{ promise: Promise<Value>; release(value: Value): Promise<void> }>;

/** A pending answer the test releases inside `act`. */
function gate<Value>(): Gate<Value> {
  let resolve: (value: Value) => void = () => {};
  const promise = new Promise<Value>((settle) => {
    resolve = settle;
  });
  return {
    promise,
    release: async (value) => {
      await act(async () => resolve(value));
    },
  };
}

/** An IPC call that rejects when it is made. */
function rejected(): Promise<never> {
  const call = Promise.reject(new Error("IPC call failed"));
  call.catch(() => undefined);
  return call;
}
type Answer<Value> = Value | Promise<Value>;

/** A preload API whose Project calls answer from queues and are logged in order. */
function scripted(
  script: Readonly<{
    list: ProjectListResult;
    activate: Answer<CanonicalProjectActivationResult>[];
    upgrade?: Answer<ProjectUpgradeResult>[];
    switch?: Answer<CanonicalProjectSwitchResult>[];
    onChoose?: () => void;
  }>,
) {
  const calls: string[] = [];
  let notify: ((status: HarnessStatus) => void) | undefined;
  const next = <Value,>(queue: Answer<Value>[] | undefined, name: string): Promise<Value> => {
    const answer = queue?.shift();
    if (answer === undefined) throw new Error(`Unexpected ${name} call`);
    return Promise.resolve(answer);
  };
  exposeApi(
    readyApi({
      subscribeHarnessStatus: (listener) => {
        notify = listener;
        return () => undefined;
      },
      chooseRepository: async () => {
        script.onChoose?.();
        return { status: "cancelled" };
      },
      listProjects: async () => {
        calls.push("list");
        return script.list;
      },
      activateProject: (request) => {
        calls.push(`activate ${request.projectId}`);
        return next(script.activate, "activateProject");
      },
      upgradeProject: (request) => {
        calls.push(`upgrade ${request.projectId}`);
        return next(script.upgrade, "upgradeProject");
      },
      switchProject: (request) => {
        calls.push(`switch ${request.from.projectId} -> ${request.to.projectId}`);
        return next(script.switch, "switchProject");
      },
    }),
  );
  return {
    calls,
    projectCalls: () => calls.filter((call) => call !== "list"),
    /** The harness restarts: `ready` with a new attempt. */
    restart: async () => {
      await act(async () => notify?.({ ...readyStatus, attempt: 2 }));
    },
  };
}

function progress(): HTMLElement {
  const element = document.getElementById("ws-progress");
  if (element === null) throw new Error("#ws-progress is not mounted");
  return element;
}

const workspace = () => screen.getByRole("region", { name: "Project workspace" });
const openButton = () => screen.getByRole("button", { name: openOlder });

async function renderAndOpenOlder() {
  render(<App />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: openOlder }));
  return user;
}

describe("updates a migration-required Project and opens it", () => {
  it("upgraded: shows each step, then opens it read-write", async () => {
    const first = gate<CanonicalProjectActivationResult>();
    const upgrade = gate<ProjectUpgradeResult>();
    const second = gate<CanonicalProjectActivationResult>();
    const api = scripted({
      list: listed("migration-required", "healthy"),
      activate: [first.promise, second.promise],
      upgrade: [upgrade.promise],
    });
    render(<App />);
    const user = userEvent.setup();
    const button = await screen.findByRole("button", { name: openOlder });

    const region = progress();
    expect(region.textContent).toBe("");
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(region.hasAttribute("role")).toBe(false);
    expect(workspace().contains(region)).toBe(false);

    await user.click(button);
    expect(progress()).toBe(region);
    expect(region.textContent).toBe("Opening Project…");

    await first.release(safeMode(olderId, migrationRequired));
    expect(progress()).toBe(region);
    expect(region.textContent).toBe("Updating Project…");
    expect(screen.queryByText("Opening Project…")).toBeNull();
    expect(openButton().hasAttribute("disabled")).toBe(true);

    await upgrade.release(upgraded);
    expect(region.textContent).toBe("Updating Project…");
    expect(screen.queryByText("Opening Project…")).toBeNull();
    expect(openButton().hasAttribute("disabled")).toBe(true);

    await second.release(active(olderId));
    const view = within(workspace());
    expect(view.getByRole("heading", { name: olderHeading })).toBeTruthy();
    expect(view.getByText("Read-write")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(region.textContent).toBe("");
    expect(api.projectCalls()).toEqual([
      `activate ${olderId}`,
      `upgrade ${olderId}`,
      `activate ${olderId}`,
    ]);
    expect(api.calls.lastIndexOf("list")).toBeGreaterThan(api.calls.indexOf(`upgrade ${olderId}`));
  });

  it("not-required: activates again and opens it read-write", async () => {
    const api = scripted({
      list: listed("migration-required", "healthy"),
      activate: [safeMode(olderId, migrationRequired), active(olderId)],
      upgrade: [notRequired],
    });
    await renderAndOpenOlder();
    expect(await within(workspace()).findByText("Read-write")).toBeTruthy();
    expect(api.projectCalls()).toEqual([
      `activate ${olderId}`,
      `upgrade ${olderId}`,
      `activate ${olderId}`,
    ]);
  });

  it.each([
    [
      "safe mode recovery-required",
      recoveryRequired,
      healthy,
      "Safe mode · Canonical recovery required",
    ],
    [
      // The harness always refuses this upgrade (runtime not healthy), so the window never asks.
      "a migration-required canonical database with a runtime needing recovery",
      migrationRequired,
      recoveryRequired,
      "Safe mode · Canonical migration required · Runtime recovery required",
    ],
    [
      "a healthy canonical database with a runtime migration",
      healthy,
      migrationRequired,
      "Safe mode · Runtime migration required",
    ],
  ] as const)("does not update %s", async (_name, canonical, runtime, label) => {
    const api = scripted({
      list: listed(canonical.status, runtime.status),
      activate: [safeMode(olderId, canonical, runtime)],
    });
    await renderAndOpenOlder();
    expect(await within(workspace()).findByText(label)).toBeTruthy();
    expect(progress().textContent).toBe("");
    expect(api.projectCalls()).toEqual([`activate ${olderId}`]);
  });

  it("switch: updates a migration-required switch target, then opens it", async () => {
    const switching = gate<CanonicalProjectSwitchResult>();
    const api = scripted({
      list: listed("migration-required", "healthy", true),
      activate: [active(otherId), active(olderId)],
      upgrade: [upgraded],
      switch: [switching.promise],
    });
    render(<App />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Open Project repo-a" }));
    expect(
      await within(workspace()).findByRole("heading", { name: "Project repo-a" }),
    ).toBeTruthy();

    await user.click(openButton());
    expect(progress().textContent).toBe("Opening Project…");
    await switching.release(
      decodeStrict(CanonicalProjectSwitchResultSchema, {
        status: "target-result",
        sourceReleased: true,
        request: {
          from: { projectId: otherId, activationId: otherId },
          to: olderRequest,
        },
        target: safeMode(olderId, migrationRequired),
      }),
    );
    expect(await within(workspace()).findByText("Read-write")).toBeTruthy();
    expect(within(workspace()).getByRole("heading", { name: olderHeading })).toBeTruthy();
    expect(api.projectCalls()).toEqual([
      `activate ${otherId}`,
      `switch ${otherId} -> ${olderId}`,
      `upgrade ${olderId}`,
      `activate ${olderId}`,
    ]);
  });
});

const rows = projectUpgradeDiagnostics;
const failed = upgradeResultForRow(olderRequest, rows.verificationFailed);
const sentence = "This Project could not be updated. Your data is intact.";
const busyReason = "A Project is being opened or updated. Try again when it finishes.";
const safeModeMigration = "Safe mode · Canonical migration required";
const notConfirmed =
  "Project selection could not be confirmed. Refresh the connection before trying again.";

/** The workspace's one alert, as its lines. */
function alertLines(): string[] {
  const alerts = within(workspace()).getAllByRole("alert");
  expect(alerts).toHaveLength(1);
  return Array.from(alerts[0]?.children ?? [], (line) => line.textContent ?? "");
}

const tryAgain = () => within(workspace()).queryByRole("button", { name: "Try again" });

async function retry(user: ReturnType<typeof userEvent.setup>) {
  const button = tryAgain();
  if (button === null) throw new Error("No Try again button");
  await user.click(button);
}

/** The panel for this result: its three lines, the safe-mode view, and an idle window. */
function expectPanel(result: ProjectUpgradeResult, label: string = safeModeMigration) {
  if (!("diagnostic" in result)) throw new Error("A failure result carries a diagnostic");
  expect(alertLines()).toEqual([
    sentence,
    result.diagnostic.message,
    `Reference: ${result.diagnostic.code}`,
  ]);
  expect(within(workspace()).getByText(label)).toBeTruthy();
  expect(progress().textContent).toBe("");
  expect(openButton().hasAttribute("disabled")).toBe(false);
}

function expectNoPanel(heading: string) {
  expect(within(workspace()).queryByText(sentence)).toBeNull();
  expect(within(workspace()).getByRole("heading", { name: heading })).toBeTruthy();
  expect(progress().textContent).toBe("");
}

const upgradeCalls = (calls: string[]) => calls.filter((call) => call.startsWith("upgrade"));

describe("explains a failed update and retries it", () => {
  it.for(Object.entries(rows))("shows the panel for %s", async ([, row]) => {
    const result = upgradeResultForRow(olderRequest, row);
    scripted({
      list: listed("migration-required", "healthy"),
      activate: [safeMode(olderId, migrationRequired)],
      upgrade: [result],
    });
    await renderAndOpenOlder();
    await within(workspace()).findByText(sentence);
    expectPanel(result);
    const button = tryAgain();
    // "Try again" only when the same request can succeed unchanged.
    if (!row.retryable) {
      expect(button).toBeNull();
      expect(document.activeElement?.textContent).toBe(sentence);
    } else {
      expect(document.activeElement).toBe(button);
      expect(within(workspace()).getByRole("alert").contains(button)).toBe(false);
    }
  });

  it("retries a failed update that then succeeds", async () => {
    const retried = gate<ProjectUpgradeResult>();
    const second = gate<CanonicalProjectActivationResult>();
    const api = scripted({
      list: listed("migration-required", "healthy"),
      activate: [safeMode(olderId, migrationRequired), second.promise],
      upgrade: [failed, retried.promise],
    });
    const user = await renderAndOpenOlder();
    await within(workspace()).findByText(sentence);
    await user.keyboard("{Enter}");
    expect(within(workspace()).queryByText(sentence)).toBeNull();
    expect(document.activeElement?.id).toBe("ws-heading");
    expect(progress().textContent).toBe("Updating Project…");
    expect(openButton().hasAttribute("disabled")).toBe(true);
    await retried.release(upgraded);
    expect(progress().textContent).toBe("Updating Project…");
    expect(openButton().hasAttribute("disabled")).toBe(true);
    await second.release(active(olderId));
    expect(within(workspace()).getByText("Read-write")).toBeTruthy();
    expect(api.projectCalls()).toEqual([
      `activate ${olderId}`,
      `upgrade ${olderId}`,
      `upgrade ${olderId}`,
      `activate ${olderId}`,
    ]);
  });

  it("retries a failed update that fails again", async () => {
    const unavailable = upgradeResultForRow(olderRequest, rows.storageUnavailable);
    const api = scripted({
      list: listed("migration-required", "healthy"),
      activate: [safeMode(olderId, migrationRequired)],
      upgrade: [failed, unavailable],
    });
    const user = await renderAndOpenOlder();
    await within(workspace()).findByText(sentence);
    await retry(user);
    await within(workspace()).findByText(rows.storageUnavailable.message);
    expectPanel(unavailable);
    expect(document.activeElement).toBe(tryAgain());
    expect(api.projectCalls()).toEqual([
      `activate ${olderId}`,
      `upgrade ${olderId}`,
      `upgrade ${olderId}`,
    ]);
  });

  it.for([
    ["upgraded", upgraded],
    ["not-required", notRequired],
  ] as const)("shows a false %s success as a broken update", async ([, result]) => {
    const api = scripted({
      list: listed("migration-required", "healthy"),
      activate: [safeMode(olderId, migrationRequired), safeMode(olderId, migrationRequired)],
      upgrade: [result],
    });
    await renderAndOpenOlder();
    await within(workspace()).findByText(sentence);
    expectPanel(upgradeResultForRow(olderRequest, rows.storageBroken));
    // A broken row is not retryable, so the panel offers no "Try again".
    expect(tryAgain()).toBeNull();
    expect(upgradeCalls(api.projectCalls())).toHaveLength(1);
  });

  it("shows a false success as a broken update whatever the runtime health", async () => {
    // U7: the post-upgrade check is canonical-only, so an unhealthy runtime keeps the panel.
    const api = scripted({
      list: listed("migration-required", "healthy"),
      activate: [
        safeMode(olderId, migrationRequired),
        safeMode(olderId, migrationRequired, recoveryRequired),
      ],
      upgrade: [upgraded],
    });
    await renderAndOpenOlder();
    await within(workspace()).findByText(sentence);
    expectPanel(
      upgradeResultForRow(olderRequest, rows.storageBroken),
      "Safe mode · Canonical migration required · Runtime recovery required",
    );
    expect(upgradeCalls(api.projectCalls())).toHaveLength(1);
  });

  it("presents another follow-up result as opening does", async () => {
    const api = scripted({
      list: listed("migration-required", "healthy"),
      activate: [
        safeMode(olderId, migrationRequired),
        decodeStrict(CanonicalProjectActivationResultSchema, {
          status: "unavailable",
          request: olderRequest,
          diagnostic: {
            code: "PROJECT_STORAGE_UNAVAILABLE",
            message: "Project Storage is unavailable.",
            retryable: true,
          },
        }),
      ],
      upgrade: [upgraded],
    });
    await renderAndOpenOlder();
    const alert = await within(workspace()).findByRole("alert");
    expect(alert.textContent).toBe("PROJECT_STORAGE_UNAVAILABLE: Project Storage is unavailable.");
    expect(within(workspace()).queryByText(sentence)).toBeNull();
    expect(progress().textContent).toBe("");
    expect(openButton().hasAttribute("disabled")).toBe(false);
    expect(upgradeCalls(api.projectCalls())).toHaveLength(1);
    expect(api.calls.slice(api.calls.indexOf(`upgrade ${olderId}`))).not.toContain("list");
  });

  it("says when the Project is not registered", async () => {
    scripted({
      list: listed("migration-required", "healthy"),
      activate: [safeMode(olderId, migrationRequired)],
      upgrade: [
        decodeStrict(ProjectUpgradeResultSchema, {
          status: "not-registered",
          request: olderRequest,
        }),
      ],
    });
    await renderAndOpenOlder();
    const alert = await within(workspace()).findByRole("alert");
    expect(alert.textContent).toBe("This Project is not registered.");
    expect(within(workspace()).queryByText(sentence)).toBeNull();
  });

  it.for([
    ["the first upgrade request", "upgrade-first"],
    ["the retried upgrade request", "upgrade-retry"],
    ["the follow-up activation", "activation"],
  ] as const)("clears the view when %s rejects", async ([, which]) => {
    scripted({
      list: listed("migration-required", "healthy"),
      activate: [
        safeMode(olderId, migrationRequired),
        ...(which === "activation" ? [rejected()] : []),
      ],
      upgrade: {
        "upgrade-first": [rejected()],
        "upgrade-retry": [failed, rejected()],
        activation: [upgraded],
      }[which],
    });
    const user = await renderAndOpenOlder();
    if (which === "upgrade-retry") {
      await within(workspace()).findByText(sentence);
      await retry(user);
    }
    const alert = await within(workspace()).findByRole("alert");
    expect(alert.textContent).toBe(notConfirmed);
    expectNoPanel("No Project selected");
    expect(openButton().hasAttribute("disabled")).toBe(false);
  });

  it("drops a pending upgrade when the harness restarts", async () => {
    const upgrade = gate<ProjectUpgradeResult>();
    const api = scripted({
      list: listed("migration-required", "healthy"),
      activate: [safeMode(olderId, migrationRequired)],
      upgrade: [upgrade.promise],
    });
    await renderAndOpenOlder();
    await within(workspace()).findByText(safeModeMigration);
    await api.restart();
    await upgrade.release(upgraded);
    expectNoPanel("No Project selected");
    expect(api.projectCalls()).toEqual([`activate ${olderId}`, `upgrade ${olderId}`]);
    const button = await screen.findByRole("button", { name: openOlder });
    expect(button.hasAttribute("disabled")).toBe(false);
  });

  it("drops a pending follow-up activation when the harness restarts", async () => {
    const second = gate<CanonicalProjectActivationResult>();
    const api = scripted({
      list: listed("migration-required", "healthy"),
      activate: [safeMode(olderId, migrationRequired), second.promise],
      upgrade: [upgraded],
    });
    await renderAndOpenOlder();
    await within(workspace()).findByText(safeModeMigration);
    await act(async () => undefined);
    expect(api.projectCalls()).toHaveLength(3);
    await api.restart();
    await second.release(active(olderId));
    expect(within(workspace()).queryByText("Read-write")).toBeNull();
    expectNoPanel("No Project selected");
  });

  it("keeps a newer open guarded when a stale upgrade settles", async () => {
    const upgrade = gate<ProjectUpgradeResult>();
    const otherActivation = gate<CanonicalProjectActivationResult>();
    const api = scripted({
      list: listed("migration-required", "healthy", true),
      activate: [safeMode(olderId, migrationRequired), otherActivation.promise],
      upgrade: [upgrade.promise],
    });
    const user = await renderAndOpenOlder();
    await within(workspace()).findByText(safeModeMigration);
    await api.restart();
    await user.click(await screen.findByRole("button", { name: "Open Project repo-a" }));
    expect(progress().textContent).toBe("Opening Project…");
    await upgrade.release(failed);
    expect(progress().textContent).toBe("Opening Project…");
    const other = screen.getByRole("button", { name: "Open Project repo-a" });
    expect(other.hasAttribute("disabled")).toBe(true);
    await otherActivation.release(active(otherId));
    expect(within(workspace()).getByText("Read-write")).toBeTruthy();
    expectNoPanel("Project repo-a");
  });

  it("does not start the add flow during an update", async () => {
    const upgrade = gate<ProjectUpgradeResult>();
    let chosen = 0;
    scripted({
      list: listed("migration-required", "healthy"),
      activate: [safeMode(olderId, migrationRequired)],
      upgrade: [upgrade.promise],
      onChoose: () => {
        chosen += 1;
      },
    });
    const user = await renderAndOpenOlder();
    await within(workspace()).findByText(safeModeMigration);
    const add = screen.getByRole("button", { name: "Add existing repository" });
    expect(add.getAttribute("aria-disabled")).toBe("true");
    await user.click(add);
    expect(chosen).toBe(0);
    expect(screen.getByText(busyReason)).toBeTruthy();
    await upgrade.release(failed);
    expectPanel(failed);
    expect(add.hasAttribute("aria-disabled")).toBe(false);
  });

  it("does not start the add flow while a Project is opening", async () => {
    const first = gate<CanonicalProjectActivationResult>();
    let chosen = 0;
    scripted({
      list: listed("migration-required", "healthy"),
      activate: [first.promise],
      onChoose: () => {
        chosen += 1;
      },
    });
    const user = await renderAndOpenOlder();
    expect(progress().textContent).toBe("Opening Project…");
    const add = screen.getByRole("button", { name: "Add existing repository" });
    expect(add.getAttribute("aria-disabled")).toBe("true");
    await user.click(add);
    expect(chosen).toBe(0);
    expect(screen.getByText(busyReason)).toBeTruthy();
    await first.release(safeMode(olderId, recoveryRequired));
    expect(add.hasAttribute("aria-disabled")).toBe(false);
  });

  it("does not start the remove flow during an update", async () => {
    const upgrade = gate<ProjectUpgradeResult>();
    scripted({
      list: listed("migration-required", "healthy", true),
      activate: [safeMode(olderId, migrationRequired)],
      upgrade: [upgrade.promise],
    });
    const user = await renderAndOpenOlder();
    await within(workspace()).findByText(safeModeMigration);
    const remove = screen.getByRole("button", { name: "Remove repo-a from list" });
    expect(remove.getAttribute("aria-disabled")).toBe("true");
    await user.click(remove);
    expect(within(workspace()).queryByText("Remove from list")).toBeNull();
    expect(screen.getByText(busyReason)).toBeTruthy();
    await upgrade.release(failed);
    expectPanel(failed);
    expect(remove.hasAttribute("aria-disabled")).toBe(false);
  });
});

describe("clears the update panel", () => {
  async function withPanel(followUps: CanonicalProjectActivationResult[] = []) {
    const api = scripted({
      list: listed("migration-required", "healthy", true),
      activate: [safeMode(olderId, migrationRequired), ...followUps],
      upgrade: [failed],
    });
    const user = await renderAndOpenOlder();
    await within(workspace()).findByText(sentence);
    return { api, user };
  }

  it("when another Project is opened", async () => {
    const { user } = await withPanel([active(otherId)]);
    await user.click(screen.getByRole("button", { name: "Open Project repo-a" }));
    await within(workspace()).findByText("Read-write");
    expect(within(workspace()).queryByText(sentence)).toBeNull();
  });

  it("when the list is refreshed", async () => {
    const { user } = await withPanel();
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(within(workspace()).queryByText(sentence)).toBeNull();
  });

  it("when the add flow starts and is cancelled", async () => {
    const { user } = await withPanel();
    await user.click(screen.getByRole("button", { name: "Add existing repository" }));
    await act(async () => undefined);
    expect(within(workspace()).queryByText(sentence)).toBeNull();
  });

  it("when the remove flow starts and is cancelled", async () => {
    const { user } = await withPanel();
    await user.click(screen.getByRole("button", { name: "Remove repo-a from list" }));
    await user.click(within(workspace()).getByRole("button", { name: "Cancel" }));
    expect(within(workspace()).queryByText(sentence)).toBeNull();
  });

  it("when the harness restarts", async () => {
    const { api } = await withPanel();
    await api.restart();
    expect(within(workspace()).queryByText(sentence)).toBeNull();
  });
});
