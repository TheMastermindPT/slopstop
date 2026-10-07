import type {
  ProjectDatabaseHealth,
  ProjectId,
  ProjectList,
  ProjectListResult,
} from "@slopstop/protocol";
import { ListProblem } from "./project-list-problem.js";
import styles from "./projects-workspace.module.css";
import { RemoveButton } from "./remove-from-list/remove-button.js";

export type Entry = ProjectList["projects"][number];
export type ListState = ProjectListResult | { status: "loading" | "idle" };

/** How the Project is named everywhere: its folder name, or a short id when it has none. */
export function projectName(project: Entry): string {
  return project.registration === "unbound"
    ? `without a repository ${project.projectId.slice(0, 8)}`
    : project.name;
}

export function safeModeLabel(
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

function storageLabel(project: Entry) {
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

function canOpen(project: Entry): boolean {
  if (project.registration === "registered") return project.repositoryLocation.status === "present";
  return project.registration === "unbound" && project.storage.status === "safe-mode";
}

export type RowProps = Readonly<{
  activeProjectId: ProjectId | undefined;
  newProjectId?: ProjectId | undefined;
  activeLabel: string | undefined;
  disabled: boolean;
  /** A Project is being opened or updated: Remove stays focusable but does not start. */
  busy: boolean;
  onOpen(project: Entry): void;
  onRemove(project: Entry): void;
  announce(message: string): void;
}>;

function ProjectRow({ project, ...props }: RowProps & Readonly<{ project: Entry }>) {
  const selected = props.activeProjectId === project.projectId;
  const isNew = props.newProjectId === project.projectId;
  return (
    <li>
      <button
        type="button"
        data-project={project.projectId}
        aria-label={`Open Project ${projectName(project)}${isNew ? ", new" : ""}`}
        aria-current={selected ? "true" : undefined}
        disabled={props.disabled || !canOpen(project) || selected}
        onClick={() => props.onOpen(project)}
      >
        <strong>
          {project.registration === "unbound" ? "Project without a repository" : project.name}
        </strong>
        <code>{project.projectId.slice(0, 8)}</code>
        <span>{storageLabel(project)}</span>
        {isNew ? <span className={styles["badge"]}>New</span> : null}
        {selected ? <span>Active · {props.activeLabel}</span> : null}
      </button>
      <RemoveButton project={project} selected={selected} {...props} />
    </li>
  );
}

/** The saved Projects, or the truthful reason they are not shown. */
export function ProjectRows({ list, ...props }: RowProps & Readonly<{ list: ListState }>) {
  if (list.status === "idle") return <p>Connect to the harness to read saved Projects.</p>;
  if (list.status === "loading") return <p aria-live="polite">Loading saved Projects…</p>;
  if (list.status !== "listed") return <ListProblem list={list} />;
  if (list.projects.length === 0 && list.hiddenCount > 0)
    return (
      <p>No Projects in your list. Removed Projects come back when you add their folder again.</p>
    );
  if (list.projects.length === 0)
    return <p>No saved Projects yet. Add an existing repository to start.</p>;
  return (
    <ul className={styles["projectList"]}>
      {list.projects.map((project) => (
        <ProjectRow key={project.projectId} project={project} {...props} />
      ))}
    </ul>
  );
}
