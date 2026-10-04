import { spawn } from "node:child_process";
import { vi } from "vitest";
import type { GitVersionInspectionRequest } from "../../src/project-registration-observer.js";
import type { RegistrationRegistry } from "../../src/registration/registration-registry.js";
import type { WindowsObserverChildIdentity } from "../../src/registration/version-observation-execution.js";
import * as native from "../../src/registration/windows-observer-api.js";

export async function startAbsenceSubject() {
  const child = spawn(
    process.execPath,
    ["--eval", "process.send('ready'); setInterval(() => {}, 1000)"],
    {
      stdio: ["ignore", "ignore", "ignore", "ipc"],
      windowsHide: true,
    },
  );
  const exited = new Promise<void>((resolve) => child.once("close", () => resolve()));
  const api = native.createWindowsObserverApi();
  const resources = new native.WindowsObserverResources(api);
  const stop = async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill();
    await exited;
    resources.close();
  };
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Absence subject did not start")), 10000);
      child.once("message", () => {
        clearTimeout(timer);
        resolve();
      });
      child.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once("exit", () => {
        clearTimeout(timer);
        reject(new Error("Absence subject exited early"));
      });
    });
    if (child.pid === undefined) throw new Error("Missing owned process id");
    const handle = resources.ownHandle(api.openProcess(0x101000, 0, child.pid));
    const creation = Buffer.alloc(8);
    native.requireWindowsSuccess(
      api,
      api.processTimes(handle, creation, Buffer.alloc(8), Buffer.alloc(8), Buffer.alloc(8)),
    );
    const session: unknown[] = [0];
    native.requireWindowsSuccess(api, api.processSession(child.pid, session));
    return {
      identity: {
        platform: "win32" as const,
        processId: child.pid,
        creationTime100ns: String(creation.readBigUInt64LE()),
        sessionId: native.nativeInteger(session[0]),
      },
      alive: () => native.nativeInteger(api.wait(handle, 0)) === 258,
      stop,
    };
  } catch (error) {
    await stop();
    throw error;
  }
}

export async function recordAbsenceSubject(
  registry: RegistrationRegistry,
  request: GitVersionInspectionRequest,
  identity: Omit<WindowsObserverChildIdentity, "jobName">,
) {
  if (request.consentId === null) throw new Error("Missing fixture consent");
  const accepted = await registry.resolve({ ...request, consentId: request.consentId });
  if (accepted.status !== "accepted") throw new Error("Missing fixture authority");
  const started = await registry.begin({
    selectionId: request.selectionId,
    consentId: request.consentId,
    executablePath: accepted.executablePath,
    executableIdentity: accepted.executableIdentity,
  });
  if (started.status !== "started") throw new Error("Fixture observation already settled");
  await registry.recordChild(started.observationId, {
    ...identity,
    jobName: `Local\\SlopStop.Registration.Observer.${started.observationId}`,
  });
  return started.observationId;
}

export const absenceFaults = [
  "inaccessible-process",
  "incomplete-snapshot",
  "unsupported-api",
  "inaccessible-job",
] as const;
export function injectAbsenceFault(fault: (typeof absenceFaults)[number]) {
  const api = native.createWindowsObserverApi();
  let hits = 0;
  const fail = () => {
    hits += 1;
    throw new Error(`controlled-${fault}`);
  };
  const selected: native.WindowsObserverApi = { ...api };
  if (fault === "inaccessible-process") {
    selected.openProcess = () => {
      hits += 1;
      return null;
    };
    selected.lastError = () => 5;
  }
  if (fault === "incomplete-snapshot") {
    selected.openProcess = () => null;
    selected.lastError = () => 87;
    // A real snapshot handle is owned/closed, but enumeration cannot prove completeness.
    selected.firstProcess = fail;
  }
  if (fault === "inaccessible-job") {
    selected.openJob = () => {
      hits += 1;
      return null;
    };
    selected.lastError = () => 5;
  }
  const spy = vi
    .spyOn(native, "createWindowsObserverApi")
    .mockImplementation(fault === "unsupported-api" ? fail : () => selected);
  return { hits: () => hits, restore: () => spy.mockRestore() };
}
