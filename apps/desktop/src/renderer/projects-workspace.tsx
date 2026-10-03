import { FolderOpenIcon } from "@phosphor-icons/react";
import type {
  CanonicalProjectActivationResult,
  HarnessStatus,
  ProjectDatabaseHealth,
  ProjectId,
  ProjectList,
  ProjectListResult,
} from "@slopstop/protocol";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import styles from "./projects-workspace.module.css";
import "./prototype/prototype-global.css";

type Active = Extract<CanonicalProjectActivationResult, { status: "active" }>;
type Session =
  | { kind: "none" }
  | { kind: "active"; activation: Active }
  | { kind: "release-failed"; activation: Active };
type View = {
  projectId: ProjectId;
  label: string;
  mode: "active" | "safe-mode" | "release-failed";
} | null;
type ListState = ProjectListResult | { status: "loading" | "idle" };

function safeModeLabel(
  canonical: ProjectDatabaseHealth["status"],
  runtime: ProjectDatabaseHealth["status"],
) {
  const failures = [
    { name: "Canonical", status: canonical },
    { name: "Runtime", status: runtime },
  ]
    .filter(({ status }) => status !== "healthy")
    .map(({ name, status }) => `${name} ${status.replaceAll("-", " ")}`);
  return ["Safe mode", ...failures].join(" · ");
}

function storageLabel(project: ProjectList["projects"][number]) {
  if (project.registration === "incomplete") return "Registration incomplete — recovery required";
  if (project.storage.status === "safe-mode")
    return safeModeLabel(project.storage.canonical, project.storage.runtime);
  if (
    project.repositoryLocation.status !== "present" &&
    project.repositoryLocation.status !== "not-bound"
  )
    return `Repository ${project.repositoryLocation.status}`;
  return `Storage ${project.storage.status.replaceAll("-", " ")}`;
}

export function ProjectsWorkspace({
  status,
  header,
}: {
  status: HarnessStatus;
  header: ReactNode;
}) {
  const ready = status.state === "ready";
  const attempt = "attempt" in status ? status.attempt : 0;
  const [list, setList] = useState<ListState>({ status: "idle" });
  const [session, setSession] = useState<Session>({ kind: "none" });
  const [view, setView] = useState<View>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const epoch = useRef(0);
  const request = useRef(0);
  const selecting = useRef(false);
  const refresh = useCallback(async () => {
    if (!ready) return;
    const current = ++request.current;
    const generation = epoch.current;
    setList({ status: "loading" });
    try {
      const result = await window.slopstop.listProjects();
      if (generation === epoch.current && current === request.current) setList(result);
    } catch {
      if (generation === epoch.current && current === request.current)
        setList({ status: "broken", code: "PROJECT_LIST_TRANSPORT_FAILED" });
    }
  }, [ready]);
  useEffect(() => {
    epoch.current += 1;
    selecting.current = false;
    setBusy(false);
    setSession({ kind: "none" });
    setView(null);
    setError(null);
    if (ready) void refresh();
    else setList({ status: "idle" });
    return () => {
      epoch.current += 1;
      request.current += 1;
    };
  }, [ready, attempt, refresh]);

  function present(result: CanonicalProjectActivationResult) {
    if (result.status === "active") {
      setSession({ kind: "active", activation: result });
      setView({
        projectId: result.request.projectId,
        label: result.access === "read-only" ? "Read-only" : "Read-write",
        mode: "active",
      });
    } else if (result.status === "safe-mode") {
      setSession({ kind: "none" });
      setView({
        projectId: result.request.projectId,
        label: safeModeLabel(result.canonicalHealth.status, result.runtimeHealth.status),
        mode: "safe-mode",
      });
    } else {
      setError(
        "diagnostic" in result
          ? `${result.diagnostic.code}: ${result.diagnostic.message}`
          : "This Project is not registered.",
      );
    }
  }

  async function switchTo(projectId: ProjectId, activation: Active, generation: number) {
    const result = await window.slopstop.switchProject({
      from: {
        projectId: activation.request.projectId,
        activationId: activation.activationId,
      },
      to: { projectId },
    });
    if (generation !== epoch.current) return;
    if (result.status === "target-result") {
      if (result.sourceReleased !== false) {
        setSession({ kind: "none" });
        setView(null);
      }
      present(result.target);
    } else if (result.status === "release-failed") {
      setSession({ kind: "release-failed", activation });
      setView({
        projectId: activation.request.projectId,
        label: "Release failed — writes unavailable",
        mode: "release-failed",
      });
      setError(result.diagnostic.message);
    } else {
      setSession({ kind: "none" });
      setView(null);
      setError(result.diagnostic.message);
    }
  }

  async function open(projectId: ProjectId) {
    if (!ready || selecting.current) return;
    selecting.current = true;
    setBusy(true);
    setError(null);
    const generation = epoch.current;
    try {
      if (session.kind === "none") {
        const result = await window.slopstop.activateProject({ projectId });
        if (generation === epoch.current) present(result);
      } else {
        await switchTo(projectId, session.activation, generation);
      }
    } catch {
      if (generation === epoch.current) {
        setSession({ kind: "none" });
        setView(null);
        setError(
          "Project selection could not be confirmed. Refresh the connection before trying again.",
        );
      }
    } finally {
      if (generation === epoch.current) {
        selecting.current = false;
        setBusy(false);
      }
    }
  }

  return (
    <main className={styles["shell"]}>
      <nav className={styles["rail"]} aria-label="Workspace">
        <span className={styles["mark"]} aria-hidden="true">
          R
        </span>
        <button
          type="button"
          aria-label="Projects"
          aria-pressed="true"
          onClick={() => document.getElementById("projects-heading")?.focus()}
        >
          <FolderOpenIcon size={23} />
        </button>
      </nav>
      <header className={styles["header"]}>
        <h1>Ragnarok</h1>
        {header}
      </header>
      <aside className={styles["sidebar"]} aria-label="Projects">
        <div className={styles["listHeader"]}>
          <h2 id="projects-heading" tabIndex={-1}>
            Projects
          </h2>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={!ready || busy || list.status === "loading"}
          >
            Refresh
          </button>
        </div>
        <div aria-busy={list.status === "loading"}>
          {list.status === "idle" ? <p>Connect to the harness to read saved Projects.</p> : null}
          {list.status === "loading" ? <p aria-live="polite">Loading saved Projects…</p> : null}
          {list.status === "listed" && list.projects.length === 0 ? (
            <p>
              No saved Projects yet. Registering a new repository in this interface is not available
              yet.
            </p>
          ) : null}
          {list.status !== "listed" && list.status !== "loading" && list.status !== "idle" ? (
            <p role="alert">
              Projects could not be read. {"code" in list ? list.code : "Request cancelled"}. Use
              Refresh to try again.
            </p>
          ) : null}
          {list.status === "listed" ? (
            <ul className={styles["projectList"]}>
              {list.projects.map((project) => {
                const selected =
                  session.kind === "active" &&
                  session.activation.request.projectId === project.projectId;
                const canOpen =
                  (project.registration === "registered" &&
                    project.repositoryLocation.status === "present") ||
                  (project.registration === "unbound" && project.storage.status === "safe-mode");
                return (
                  <li key={project.projectId}>
                    <button
                      type="button"
                      aria-label={`Open project ${project.projectId}`}
                      aria-current={selected ? "true" : undefined}
                      disabled={!ready || busy || !canOpen || selected}
                      onClick={() => void open(project.projectId)}
                    >
                      <strong>Project {project.projectId.slice(0, 8)}</strong>
                      <code>{project.projectId}</code>
                      <span>{storageLabel(project)}</span>
                      {selected ? (
                        <span>
                          Active ·{" "}
                          {session.activation.access === "read-only" ? "Read-only" : "Read-write"}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
        <p className={styles["asideNote"]}>
          Local Projects. No repository commands run while listing.
        </p>
      </aside>
      <section className={styles["workspace"]} aria-label="Project workspace" aria-busy={busy}>
        {error ? (
          <p className={styles["error"]} role="alert">
            {error}
          </p>
        ) : null}
        {busy ? <p aria-live="polite">Opening Project…</p> : null}
        <h2>{view === null ? "No Project selected" : `Project ${view.projectId.slice(0, 8)}`}</h2>
        {view === null ? (
          <p>
            Choose a saved Project to open its local workspace. Access is checked when you open it.
          </p>
        ) : (
          <>
            <code>{view.projectId}</code>
            <p className={styles["access"]}>{view.label}</p>
            <p>
              {view.mode === "active"
                ? "Project identity and local Storage are connected. Conversation and repository registration controls are not available in this view yet."
                : "Writes unavailable. Storage needs attention before this Project can be used."}
            </p>
          </>
        )}
      </section>
    </main>
  );
}
