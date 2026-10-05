import { FolderOpenIcon } from "@phosphor-icons/react";
import type {
  CanonicalProjectActivationResult,
  HarnessStatus,
  ProjectId,
} from "@slopstop/protocol";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useAddRepository } from "./add-repository/use-add-repository.js";
import { AddRepositoryButton } from "./add-repository-button.js";
import { type ListState, ProjectRows, safeModeLabel } from "./projects-list.js";
import styles from "./projects-workspace.module.css";
import { useRemoveFromList } from "./remove-from-list/use-remove-from-list.js";
import {
  rememberNames,
  useRegistrationCapability,
  workspaceFlowHost,
  workspaceRemovalHost,
} from "./workspace-hooks.js";
import { type View, WorkspaceSection } from "./workspace-view.js";
import "./prototype/prototype-global.css";

type Active = Extract<CanonicalProjectActivationResult, { status: "active" }>;
type Session =
  | { kind: "none" }
  | { kind: "active"; activation: Active }
  | { kind: "release-failed"; activation: Active };

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
  const capability = useRegistrationCapability(ready, attempt);
  const [announcement, setAnnouncement] = useState("");
  const names = useRef(new Map<ProjectId, string>());
  const [newProjectId, setNewProjectId] = useState<ProjectId | undefined>(undefined);
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
      rememberNames(names.current, result);
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

  const nameOf = (projectId: ProjectId) => names.current.get(projectId) ?? projectId.slice(0, 8);

  function present(result: CanonicalProjectActivationResult) {
    if (result.status === "active") {
      setSession({ kind: "active", activation: result });
      setView({
        projectId: result.request.projectId,
        name: nameOf(result.request.projectId),
        label: result.access === "read-only" ? "Read-only" : "Read-write",
        mode: "active",
      });
    } else if (result.status === "safe-mode") {
      setSession({ kind: "none" });
      setView({
        projectId: result.request.projectId,
        name: nameOf(result.request.projectId),
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
        name: nameOf(activation.request.projectId),
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

  const flow = useAddRepository(
    workspaceFlowHost({
      registered: (projectId) => {
        setNewProjectId(projectId);
        void refresh();
      },
      restored: () => void refresh(),
      open: (projectId) => void open(projectId),
      announce: setAnnouncement,
    }),
  );

  const removal = useRemoveFromList(
    workspaceRemovalHost({
      visibleOrder: () =>
        list.status === "listed" ? list.projects.map((project) => project.projectId) : [],
      refresh,
      announce: setAnnouncement,
    }),
  );

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
        <AddRepositoryButton
          capability={capability}
          list={list}
          onAdd={flow.start}
          announce={setAnnouncement}
        />
        <div aria-busy={list.status === "loading"}>
          <ProjectRows
            list={list}
            activeProjectId={
              session.kind === "active" ? session.activation.request.projectId : undefined
            }
            activeLabel={
              session.kind === "active" && session.activation.access === "read-only"
                ? "Read-only"
                : "Read-write"
            }
            newProjectId={newProjectId}
            disabled={!ready || busy}
            onOpen={(project) => void open(project.projectId)}
            onRemove={(project) =>
              project.registration !== "unbound" &&
              removal.ask({ projectId: project.projectId, name: project.name })
            }
            announce={setAnnouncement}
          />
        </div>
        <p className={styles["asideNote"]}>
          Local Projects. No repository commands run while listing.
        </p>
      </aside>
      <p className={styles["srOnly"]} aria-live="polite">
        {announcement}
      </p>
      <WorkspaceSection flow={flow} removal={removal} view={view} error={error} busy={busy} />
    </main>
  );
}
