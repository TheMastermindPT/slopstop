import type {
  ObserverAbsencePort,
  WindowsObserverChildIdentity,
} from "./version-observation-execution.js";
import {
  createWindowsObserverApi,
  nativeInteger,
  requireWindowsSuccess,
  WindowsObserverApiError,
  WindowsObserverResources,
} from "./windows-observer-api.js";

function snapshotContainsProcess(resources: WindowsObserverResources, processId: number): boolean {
  const { api } = resources;
  const snapshot = resources.ownHandle(api.processSnapshot(2, 0));
  const entry = Buffer.alloc(568); // PROCESSENTRY32W, win32-x64 only.
  entry.writeUInt32LE(entry.length);
  requireWindowsSuccess(api, api.firstProcess(snapshot, entry));
  for (;;) {
    if (entry.readUInt32LE(8) === processId) return true;
    if (nativeInteger(api.nextProcess(snapshot, entry)) !== 0) continue;
    const code = nativeInteger(api.lastError());
    if (code !== 18) throw new WindowsObserverApiError(code);
    return false;
  }
}

function exactProcessAbsent(
  resources: WindowsObserverResources,
  child: WindowsObserverChildIdentity,
): boolean {
  const { api } = resources;
  const raw = api.openProcess(0x101000, 0, child.processId);
  const error = nativeInteger(api.lastError());
  if (raw === null) {
    if (error !== 87) throw new WindowsObserverApiError(error);
    // An open failure alone is not absence: require a complete process snapshot.
    return !snapshotContainsProcess(resources, child.processId);
  }
  const handle = resources.ownHandle(raw);
  const creation = Buffer.alloc(8);
  requireWindowsSuccess(
    api,
    api.processTimes(handle, creation, Buffer.alloc(8), Buffer.alloc(8), Buffer.alloc(8)),
  );
  if (String(creation.readBigUInt64LE()) !== child.creationTime100ns) return true;
  const wait = nativeInteger(api.wait(handle, 0));
  if (wait === 0) return true;
  if (wait === 258) return false;
  throw new Error("Windows observer process absence could not be observed.");
}

function exactJobAbsent(resources: WindowsObserverResources, jobName: string): boolean {
  const { api } = resources;
  const raw = api.openJob(4, 0, jobName);
  const error = nativeInteger(api.lastError());
  if (raw === null) {
    if (error !== 2) throw new WindowsObserverApiError(error);
    return true;
  }
  const job = resources.ownHandle(raw);
  const accounting = Buffer.alloc(48);
  requireWindowsSuccess(api, api.queryJob(job, 1, accounting, accounting.length, null));
  return accounting.readUInt32LE(40) === 0;
}

function inspectSameSession(child: WindowsObserverChildIdentity): boolean {
  const resources = new WindowsObserverResources(createWindowsObserverApi());
  try {
    const session: unknown[] = [0];
    requireWindowsSuccess(resources.api, resources.api.processSession(process.pid, session));
    if (nativeInteger(session[0]) !== child.sessionId) return false;
    if (!exactProcessAbsent(resources, child)) return false;
    return exactJobAbsent(resources, child.jobName);
  } finally {
    resources.close();
  }
}

export function createWindowsObserverAbsencePort(): ObserverAbsencePort {
  return {
    inspect: async (child) => {
      if (process.platform !== "win32" || process.arch !== "x64") {
        return { status: "unconfirmed" };
      }
      if (child.sessionId === undefined) return { status: "unconfirmed" };
      return { status: inspectSameSession(child) ? "absent" : "unconfirmed" };
    },
  };
}
