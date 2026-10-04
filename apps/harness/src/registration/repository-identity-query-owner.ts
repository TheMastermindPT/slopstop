import { randomUUID } from "node:crypto";
import { decodeStrict } from "@slopstop/protocol";
import {
  observeRepositoryDirectory,
  observeSelectedExecutable,
} from "../storage/repository-identity-observer.js";
import { sameExecutableIdentity } from "./executable-identity.js";
import {
  classifyIdentityBooleanValues,
  composeIdentityQueryValues,
  decodeIdentityQueryOutput,
} from "./git-identity-query-results.js";
import {
  type IdentityQueryChildPort,
  type IdentityQueryDispatch,
  type IdentityQueryKind,
  identityQueryKinds,
} from "./identity-query-child.js";
import {
  type IdentityQueryControl as Control,
  createIdentityQueryControl,
  identityQueryInterruption as interruption,
} from "./identity-query-control.js";
import { createIdentityQueryJournal } from "./identity-query-journal.js";
import { REGISTRATION_CLEANUP_BUDGET_MS } from "./observer-limits.js";
import { type RepositoryPhysicalSnapshot, samePhysicalIdentity } from "./physical-identity.js";
import type { RegistrationDatabaseOptions } from "./registry-database.js";
import { registryFailure } from "./registry-failure.js";
import {
  completePhysicalObservation,
  discoverSelectedPhysical,
  revalidateRepositoryPhysical,
} from "./repository-physical-observation.js";
import {
  type IdentityQueryAdmissionPort,
  RepositoryIdentityAdmissionRequestSchema,
  type RepositoryTrustOwner,
} from "./repository-trust.js";
import { createWindowsIdentityQueryChild } from "./windows-version-child.js";

type Request = Parameters<RepositoryTrustOwner["admitRepositoryIdentityQueries"]>[0];
type InspectionMode = "single" | "queries" | "physical";
type AdmissionAuthority = Parameters<IdentityQueryAdmissionPort["admit"]>[0];
type Journal = ReturnType<typeof createIdentityQueryJournal>;
type Started = Extract<Awaited<ReturnType<Journal["begin"]>>, { status: "started" }>;
const pending = { status: "pending-recovery", code: "OBSERVER_CLEANUP_UNCONFIRMED" } as const;

function visibleResult<Result extends Readonly<{ status: string }>>(
  result: Result,
  control: Control,
) {
  if (!["query-observed", "identity-observed", "physically-observed"].includes(result.status))
    return result;
  return interruption(control) ?? result;
}

async function revalidate(started: Started, control: Control) {
  const { authority } = started;
  const executable = await observeSelectedExecutable(authority.executable.executablePath);
  if (executable.status !== "observed") return executable;
  if (!sameExecutableIdentity(executable.identity, authority.executable.executableIdentity)) {
    return { status: "unavailable", code: "GIT_CONFIRMATION_REQUIRED" } as const;
  }
  const directory = await observeRepositoryDirectory(authority.repositoryDirectory);
  if (directory.status !== "observed") return directory;
  if (!samePhysicalIdentity(directory.key, authority.repositoryIdentity)) {
    return { status: "unavailable", code: "REPOSITORY_TRUST_REQUIRED" } as const;
  }
  if (started.phase.physical !== undefined) {
    return revalidateRepositoryPhysical(
      authority.repositoryDirectory,
      started.phase.physical,
      control,
    );
  }
  return { status: "matched" } as const;
}

async function decodeCurrentOutput(
  output: Extract<Awaited<ReturnType<IdentityQueryChildPort["run"]>>, { status: "exited" }>,
  started: Started,
  control: Control,
) {
  const decoded = decodeIdentityQueryOutput(
    started.phase.query,
    output,
    started.authority.repositoryIdentity.platform,
  );
  if (decoded.status !== "query-observed") return decoded;
  const after = await revalidate(started, control);
  const stopped = interruption(control);
  if (stopped !== undefined) return stopped;
  if (after.status !== "matched") return after;
  return decoded;
}

function cleanupFailure(
  output: Extract<
    Awaited<ReturnType<IdentityQueryChildPort["run"]>>,
    { status: "cleanup-unconfirmed" }
  >,
  control: Control,
) {
  if (output.trigger !== "CANCELLED") return { ...pending, trigger: output.trigger };
  const cause = interruption(control);
  return { ...pending, trigger: cause?.status === "unavailable" ? cause.code : output.trigger };
}

async function settleOutput(
  journal: Journal,
  started: Started,
  output: Awaited<ReturnType<IdentityQueryChildPort["run"]>>,
  control: Control,
) {
  const id = started.observationId;
  if (output.status === "cleanup-unconfirmed") return cleanupFailure(output, control);
  if (output.status === "unavailable") {
    await journal.noDispatch(id, output);
    return output;
  }
  const terminal =
    output.status === "exited"
      ? {
          exitCode: output.exitCode,
          stdoutClosed: true as const,
          stderrClosed: true as const,
          treeEmpty: true as const,
        }
      : output.terminal;
  await journal.recordTerminal(id, terminal);
  const result =
    output.status === "exited"
      ? await decodeCurrentOutput(output, started, control)
      : output.status === "cancelled"
        ? (interruption(control) ?? { status: "cancelled" as const })
        : { status: "unavailable" as const, code: output.code };
  const settled = await journal.settle(id, () => visibleResult(result, control));
  return visibleResult(settled, control);
}

async function runQuery(
  journal: Journal,
  child: IdentityQueryChildPort,
  started: Started,
  control: Control,
) {
  const before = await revalidate(started, control);
  const stopped = interruption(control);
  if (stopped !== undefined) {
    await journal.noDispatch(started.observationId, stopped);
    return stopped;
  }
  if (before.status !== "matched") {
    await journal.noDispatch(started.observationId, before);
    return before;
  }
  const output = await child.run(
    {
      executablePath: started.authority.executable.executablePath,
      repositoryDirectory: started.authority.repositoryDirectory,
      query: started.phase.query,
      observationId: started.observationId,
      onOwned: (owned) => journal.recordChild(started.observationId, owned),
    },
    control.signal,
  );
  return settleOutput(journal, started, output, control);
}

async function executeAdmitted(
  journal: Journal,
  child: IdentityQueryChildPort,
  dispatch: IdentityQueryDispatch & { request: Request },
  control: Control,
) {
  const stopped = interruption(control);
  if (stopped !== undefined) return stopped;
  const { request, ...phase } = dispatch;
  const started = await journal.begin(request, phase);
  if (started.status !== "started") return started;
  try {
    return await runQuery(journal, child, started, control);
  } catch {
    return { ...pending, trigger: "INTERNAL_FAILURE" as const };
  }
}

async function collectQueries(
  queries: readonly IdentityQueryKind[],
  execute: (query: IdentityQueryKind) => ReturnType<typeof executeAdmitted>,
  values: Map<IdentityQueryKind, boolean | string>,
) {
  for (const query of queries) {
    const result = await execute(query);
    if (result.status !== "query-observed") return result;
    values.set(query, "insideWorkTree" in result ? result.insideWorkTree : result.value);
  }
  return { status: "collected" } as const;
}

async function executePhase(
  dependencies: { journal: Journal; child: IdentityQueryChildPort },
  request: Request,
  control: Control,
  phase: {
    phaseId: string;
    selectedDirectory: string;
    purpose: "queries" | "physical";
    physical?: RepositoryPhysicalSnapshot;
  },
) {
  const values = new Map<IdentityQueryKind, boolean | string>();
  const execute = (query: IdentityQueryKind) =>
    executeAdmitted(
      dependencies.journal,
      dependencies.child,
      { request, ...phase, ordinal: identityQueryKinds.indexOf(query), query },
      control,
    );
  const first = await collectQueries(identityQueryKinds.slice(0, 3), execute, values);
  if (first.status !== "collected") return first;
  const booleans = classifyIdentityBooleanValues([
    values.get("inside-work-tree"),
    values.get("bare-repository"),
    values.get("inside-git-dir"),
  ]);
  if (booleans.status !== "working-tree") return booleans;
  // Missing .git is not a bare/non-Git classification. Only Git's booleans decide that.
  // A working-tree answer still cannot authorize paths without a complete root graph.
  if (phase.purpose === "physical" && phase.physical === undefined) {
    return { status: "rejected", code: "OBSERVATION_INVALID" } as const;
  }
  const paths = await collectQueries(identityQueryKinds.slice(3), execute, values);
  if (paths.status !== "collected") return paths;
  const result = composeIdentityQueryValues(phase.phaseId, values);
  if (phase.physical === undefined || result.status !== "identity-observed")
    return visibleResult(result, control);
  return visibleResult(
    await completePhysicalObservation(
      result,
      { directory: phase.selectedDirectory, expected: phase.physical },
      control,
    ),
    control,
  );
}

async function inspectPhysicalPhase(
  dependencies: { journal: Journal; child: IdentityQueryChildPort },
  input: { request: Request; authority: AdmissionAuthority; phaseId: string },
  control: Control,
) {
  const { request, authority, phaseId } = input;
  const captured = await discoverSelectedPhysical(
    { directory: authority.repositoryDirectory, identity: authority.repositoryIdentity },
    control,
  );
  const phase = {
    phaseId,
    selectedDirectory: authority.repositoryDirectory,
    purpose: "physical" as const,
  };
  if (captured.status === "unresolved") return executePhase(dependencies, request, control, phase);
  if (captured.status !== "captured") return captured;
  return executePhase(dependencies, request, control, { ...phase, physical: captured.snapshot });
}

function inspectAdmitted(
  dependencies: { journal: Journal; child: IdentityQueryChildPort },
  input: { request: Request; authority: AdmissionAuthority; mode: InspectionMode },
  control: Control,
) {
  const { request, authority, mode } = input;
  const phaseId = randomUUID();
  const operations = {
    single: () =>
      executeAdmitted(
        dependencies.journal,
        dependencies.child,
        { request, phaseId, ordinal: 0, query: "inside-work-tree" },
        control,
      ),
    queries: () =>
      executePhase(dependencies, request, control, {
        phaseId,
        selectedDirectory: authority.repositoryDirectory,
        purpose: "queries",
      }),
    physical: () => inspectPhysicalPhase(dependencies, { request, authority, phaseId }, control),
  };
  return operations[mode]();
}

async function inspectQuery(
  dependencies: { registry: RepositoryTrustOwner; journal: Journal; child: IdentityQueryChildPort },
  input: Request,
  control: Control,
  mode: InspectionMode,
) {
  const { registry, journal, child } = dependencies;
  let result: Awaited<ReturnType<typeof inspectAdmitted>> | undefined;
  try {
    const request = decodeStrict(RepositoryIdentityAdmissionRequestSchema, input);
    const admission = await registry.admitRepositoryIdentityQueries(request, {
      admit: async (authority) => {
        result = await inspectAdmitted({ journal, child }, { request, authority, mode }, control);
      },
    });
    if (admission.status !== "admitted") return admission;
    return result ?? ({ status: "broken", code: "INTERNAL_FAILURE" } as const);
  } catch (error) {
    return registryFailure(error);
  }
}

async function drain(
  work: Iterable<Promise<Awaited<ReturnType<typeof inspectQuery>>>>,
  hasUnsettled: () => Promise<boolean>,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.allSettled(work)
        .then(async (results) => {
          for (const result of results) {
            if (result.status === "rejected") return pending;
            if (result.value.status === "pending-recovery") return pending;
          }
          if (await hasUnsettled()) return pending;
          return { status: "closed" } as const;
        })
        .catch(() => pending),
      new Promise<typeof pending>((resolve) => {
        timer = setTimeout(() => resolve(pending), REGISTRATION_CLEANUP_BUDGET_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export function createRepositoryIdentityQueryOwner(
  registry: RepositoryTrustOwner,
  options: RegistrationDatabaseOptions,
  controlDirectory: string,
  child: IdentityQueryChildPort = createWindowsIdentityQueryChild(controlDirectory),
) {
  const journal = createIdentityQueryJournal(options);
  const active = new Map<AbortController, Promise<Awaited<ReturnType<typeof inspectQuery>>>>();
  let closing: ReturnType<typeof drain> | undefined;
  let closed = false;
  const inspect = async (input: Request, signal: AbortSignal | undefined, mode: InspectionMode) => {
    if (closed) return { status: "cancelled" } as const;
    const phase = createIdentityQueryControl(signal);
    const { controller, control } = phase;
    const work = inspectQuery({ registry, journal, child }, input, control, mode);
    active.set(controller, work);
    try {
      return visibleResult(await work, control);
    } finally {
      phase.dispose();
      active.delete(controller);
    }
  };
  return {
    inspectPhysicalIdentity: (input: Request, signal?: AbortSignal) =>
      inspect(input, signal, "physical"),
    inspectIdentity: (input: Request, signal?: AbortSignal) => inspect(input, signal, "queries"),
    close: () => {
      if (closing !== undefined) return closing;
      closed = true;
      for (const controller of active.keys()) controller.abort();
      closing = drain(active.values(), journal.hasUnsettled).then((result) => {
        if (result.status === "pending-recovery") closing = undefined;
        return result;
      });
      return closing;
    },
    inspectInsideWorkTree: (input: Request, signal?: AbortSignal) =>
      inspect(input, signal, "single"),
  };
}
