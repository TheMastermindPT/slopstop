import path from "node:path";
import {
  createProjectActivateCommand,
  createProjectRegistrationCommand,
  decodeStrict,
  ProjectListResultSchema,
} from "@slopstop/protocol";
import { Effect } from "effect";
import { expect, it } from "vitest";
import { startHarnessRuntime } from "../../src/index.js";
import type { ProjectStorageActivationOutcome } from "../../src/project-storage-application.js";
import { createListRemoval, withListRemoval } from "../../src/registration/list-visibility.js";
import { listRegisteredProjects } from "../../src/registration/project-listing.js";
import type { ProjectRegistrationFlow } from "../../src/registration/project-registration-flow.js";
import { fixture } from "./active-project-coordinator-fixture.js";
import { TestTransport } from "./harness-test-transport.js";
import { switchDeferred, switchRuntimeOptions } from "./project-storage-create-fixture.js";
import { checkedInMigrationRoot } from "./project-storage-runtime-fixture.js";
import { registerFolder, registrationSession } from "./registration-flow-fixture.js";

const unusedFlow: ProjectRegistrationFlow = {
  handle: () => Effect.die(new Error("Only Remove from list is exercised here.")),
};

/** A registered Project in a real installation, plus a runtime whose activation can be held. */
async function raceRuntime() {
  const session = await registrationSession();
  const { registered } = await registerFolder(session, session.directory);
  if (registered.status !== "registered") throw new Error("Registration missing");
  const { projectId } = registered;
  await session.dispose();
  const options = {
    applicationStorageRoot: path.join(session.root, "installation"),
    migrationResourcesRoot: checkedInMigrationRoot,
  };
  const coordinator = fixture(false, projectId);
  const held = switchDeferred<ProjectStorageActivationOutcome>();
  const entered = switchDeferred<void>();
  coordinator.dependencies.storage.acquireActivation.mockImplementationOnce(() => {
    entered.resolve();
    return held.promise;
  });
  const transport = new EventTransport();
  const stop = startHarnessRuntime({
    ...switchRuntimeOptions(coordinator.owner, transport),
    projectRegistration: withListRemoval(
      unusedFlow,
      createListRemoval({ options, withHeldProject: coordinator.owner.withHeldProject }),
    ),
  });
  const dispose = async () => {
    await stop();
    await coordinator.owner.stop();
  };
  const listed = async () => {
    const result = decodeStrict(
      ProjectListResultSchema,
      await listRegisteredProjects(
        { ...options, applicationVersion: "0.0.0" },
        new AbortController().signal,
      ),
    );
    if (result.status !== "listed") throw new Error(`List unavailable: ${result.status}`);
    return result.projects.map((project) => project.projectId);
  };
  return { projectId, coordinator, held, entered, transport, listed, dispose };
}

let sequence = 700;
const metadata = () => ({
  messageId: `00000000-0000-4000-8000-${String(sequence++).padStart(12, "0")}`,
  sentAt: "2026-10-05T12:00:00.000Z",
});

/** A test transport that resolves the first payload of each awaited event. */
class EventTransport extends TestTransport {
  readonly #waiting = new Map<string, (payload: unknown) => void>();

  override send(message: unknown): void {
    super.send(message);
    if (typeof message !== "object" || message === null) return;
    const event = Reflect.get(message, "event");
    if (typeof event === "string") this.#waiting.get(event)?.(Reflect.get(message, "payload"));
  }

  settled(event: string): Promise<unknown> {
    return new Promise((resolve) => this.#waiting.set(event, resolve));
  }
}

it.runIf(process.platform === "win32")(
  "refuses to hide a Project whose activation was admitted before the removal",
  async () => {
    const race = await raceRuntime();
    try {
      const remove = { step: "remove-from-list", projectId: race.projectId } as const;
      const activated = race.transport.settled("project.activate.result");
      const removed = race.transport.settled("project.registration.result");

      race.transport.emit(createProjectActivateCommand(metadata(), { projectId: race.projectId }));
      await race.entered.promise;
      race.transport.emit(createProjectRegistrationCommand(metadata(), remove));
      race.held.resolve({ status: "ready", session: race.coordinator.session });

      expect(await activated).toMatchObject({ status: "active" });
      expect(await removed).toEqual({ status: "rejected", code: "PROJECT_ACTIVE" });
      expect(await race.listed()).toEqual([race.projectId]);
    } finally {
      race.held.resolve({ status: "ready", session: race.coordinator.session });
      await race.dispose();
    }
  },
);

it.runIf(process.platform === "win32")(
  "activates a Project normally when its removal settled first",
  async () => {
    const race = await raceRuntime();
    try {
      const remove = { step: "remove-from-list", projectId: race.projectId } as const;
      const removed = race.transport.settled("project.registration.result");
      race.transport.emit(createProjectRegistrationCommand(metadata(), remove));
      expect(await removed).toEqual({ status: "removed", projectId: race.projectId });

      const activated = race.transport.settled("project.activate.result");
      race.transport.emit(createProjectActivateCommand(metadata(), { projectId: race.projectId }));
      await race.entered.promise;
      race.held.resolve({ status: "ready", session: race.coordinator.session });

      expect(await activated).toMatchObject({ status: "active" });
      expect(await race.listed()).toEqual([]);
    } finally {
      race.held.resolve({ status: "ready", session: race.coordinator.session });
      await race.dispose();
    }
  },
);
