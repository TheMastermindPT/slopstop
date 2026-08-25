import {
  BellRingingIcon,
  CaretDownIcon,
  ChatCircleDotsIcon,
  CheckCircleIcon,
  CodeIcon,
  DotsThreeIcon,
  FileIcon,
  FolderIcon,
  FolderOpenIcon,
  GearSixIcon,
  GitDiffIcon,
  GraphIcon,
  MagnifyingGlassIcon,
  MapTrifoldIcon,
  PlayIcon,
  PulseIcon,
  PushPinIcon,
  TerminalWindowIcon,
  XIcon,
} from "@phosphor-icons/react";
import styles from "./prototype-app.module.css";
import {
  type ActivitySection,
  attentionItems,
  type CenterSurface,
  type FileFixture,
  files,
  projects,
  type RunFixture,
  runs,
} from "./prototype-fixtures.js";
import type { SettingsScope } from "./prototype-model.js";

const railLabels: Record<ActivitySection, string> = {
  projects: "Projects",
  attention: "Attention",
  files: "Files",
  runs: "Runs",
};

const logLines = [
  "19:03:08  run-42  implementer      wrote src/features/session-store.ts",
  "19:03:11  run-42  test-author      red evidence accepted for refresh restore",
  "19:03:17  run-42  repository-reader stale path found in timer-reducer.ts",
  "19:03:22  run-42  coordinator      task 3/5 settled; budget remains within envelope",
];

function RailButton({
  active,
  badge,
  children,
  label,
  onClick,
}: Readonly<{
  active: boolean;
  badge?: number;
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}>) {
  return (
    <button
      type="button"
      className={styles["rail-button"]}
      data-active={active}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
      {badge === undefined ? null : <span className={styles["rail-badge"]}>{badge}</span>}
    </button>
  );
}

export function ActivityRail({
  activeSection,
  onDiagnostics,
  onSection,
  onSettings,
}: Readonly<{
  activeSection: ActivitySection;
  onDiagnostics: () => void;
  onSection: (section: ActivitySection) => void;
  onSettings: () => void;
}>) {
  return (
    <aside className={styles["activity-rail"]} aria-label="Workspace destinations">
      <div className={styles["product-mark"]} role="img" aria-label="SlopStop">
        S
      </div>
      <nav className={styles["rail-group"]} aria-label="Primary workspace">
        <RailButton
          label="Projects"
          active={activeSection === "projects"}
          onClick={() => onSection("projects")}
        >
          <FolderOpenIcon size={20} weight={activeSection === "projects" ? "fill" : "regular"} />
        </RailButton>
        <RailButton
          label="Attention"
          badge={attentionItems.length}
          active={activeSection === "attention"}
          onClick={() => onSection("attention")}
        >
          <BellRingingIcon size={20} weight={activeSection === "attention" ? "fill" : "regular"} />
        </RailButton>
        <RailButton
          label="Files"
          active={activeSection === "files"}
          onClick={() => onSection("files")}
        >
          <CodeIcon size={20} weight={activeSection === "files" ? "fill" : "regular"} />
        </RailButton>
        <RailButton
          label="Runs"
          badge={runs.filter((run) => run.status === "active").length}
          active={activeSection === "runs"}
          onClick={() => onSection("runs")}
        >
          <PulseIcon size={20} weight={activeSection === "runs" ? "fill" : "regular"} />
        </RailButton>
      </nav>
      <div className={styles["rail-group-bottom"]}>
        <RailButton label="Diagnostics" active={false} onClick={onDiagnostics}>
          <TerminalWindowIcon size={20} />
        </RailButton>
        <RailButton label="Settings" active={false} onClick={onSettings}>
          <GearSixIcon size={20} />
        </RailButton>
      </div>
    </aside>
  );
}

function ProjectsSidebar({
  activeProjectId,
  onSelect,
}: Readonly<{ activeProjectId: string; onSelect: (projectId: string) => void }>) {
  return (
    <div className={styles["sidebar-content"]}>
      <label className={styles["search-field"]}>
        <MagnifyingGlassIcon size={15} aria-hidden="true" />
        <span className={styles["visually-hidden"]}>Filter Projects</span>
        <input type="search" placeholder="Filter Projects" />
      </label>
      <div className={styles["project-list"]}>
        {projects.map((project) => (
          <button
            key={project.id}
            type="button"
            className={styles["project-row"]}
            data-active={project.id === activeProjectId}
            onClick={() => onSelect(project.id)}
          >
            <span className={styles["project-monogram"]}>{project.name.slice(0, 2)}</span>
            <span>
              <strong>{project.name}</strong>
              <small>{project.branch}</small>
            </span>
            <span className={styles["project-count"]}>{project.attentionCount}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function AttentionSidebar({ onSelect }: Readonly<{ onSelect: (id: string) => void }>) {
  return (
    <div className={styles["sidebar-content"]}>
      <div className={styles["sidebar-summary"]}>
        <span>Needs you</span>
        <strong>{attentionItems.length}</strong>
        <small>Impact first, then oldest</small>
      </div>
      <div className={styles["attention-list"]}>
        {attentionItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={styles["attention-row"]}
            data-kind={item.kind}
            onClick={() => onSelect(item.id)}
          >
            <span className={styles["attention-signal"]} aria-hidden="true" />
            <span className={styles["attention-copy"]}>
              <span>
                <strong>{item.title}</strong>
                <time>{item.age}</time>
              </span>
              <small>{item.detail}</small>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function FilesSidebar({ onOpen }: Readonly<{ onOpen: (file: FileFixture) => void }>) {
  return (
    <div className={styles["sidebar-content"]}>
      <div className={styles["explorer-heading"]}>
        <span>MAXREPS</span>
        <DotsThreeIcon size={18} aria-hidden="true" />
      </div>
      <div className={styles["file-tree"]} role="tree" aria-label="Project files">
        {files.map((file) => {
          const indent = { paddingInlineStart: `${12 + file.depth * 15}px` };
          if (file.kind === "folder") {
            return (
              <div
                key={file.id}
                className={styles["folder-row"]}
                role="treeitem"
                aria-expanded="true"
                tabIndex={-1}
                style={indent}
              >
                <CaretDownIcon size={13} aria-hidden="true" />
                <FolderIcon size={15} weight="fill" aria-hidden="true" />
                <span>{file.name}</span>
              </div>
            );
          }
          return (
            <button
              key={file.id}
              type="button"
              role="treeitem"
              className={styles["file-row"]}
              style={indent}
              aria-label={file.name}
              onClick={() => onOpen(file)}
            >
              <FileIcon size={15} aria-hidden="true" />
              <span>{file.name}</span>
              {file.changed ? <span className={styles["changed-dot"]}>M</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RunsSidebar({
  activeRunId,
  onSelect,
}: Readonly<{ activeRunId: string | undefined; onSelect: (run: RunFixture) => void }>) {
  return (
    <div className={styles["sidebar-content"]}>
      <div className={styles["run-section-label"]}>Active and reviewable</div>
      <div className={styles["run-list"]}>
        {runs.map((run) => (
          <button
            key={run.id}
            type="button"
            className={styles["run-row"]}
            data-active={run.id === activeRunId}
            data-status={run.status}
            onClick={() => onSelect(run)}
          >
            <span className={styles["run-number"]}>Run {run.number}</span>
            <strong>{run.title}</strong>
            <span className={styles["run-meta"]}>
              <span>{run.statusLabel}</span>
              <time>{run.elapsed}</time>
            </span>
            <span className={styles["run-progress"]}>
              <span style={{ width: run.status === "active" ? run.progress : "100%" }} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SidebarContent({
  activeProjectId,
  activeRunId,
  activeSection,
  onAttention,
  onFile,
  onProject,
  onRun,
}: Readonly<{
  activeProjectId: string;
  activeRunId: string | undefined;
  activeSection: ActivitySection;
  onAttention: (id: string) => void;
  onFile: (file: FileFixture) => void;
  onProject: (projectId: string) => void;
  onRun: (run: RunFixture) => void;
}>) {
  switch (activeSection) {
    case "projects":
      return <ProjectsSidebar activeProjectId={activeProjectId} onSelect={onProject} />;
    case "attention":
      return <AttentionSidebar onSelect={onAttention} />;
    case "files":
      return <FilesSidebar onOpen={onFile} />;
    case "runs":
      return <RunsSidebar activeRunId={activeRunId} onSelect={onRun} />;
  }
}

export function WorkspaceSidebar({
  activeProjectId,
  activeRunId,
  activeSection,
  onAttention,
  onFile,
  onProject,
  onRun,
}: Readonly<{
  activeProjectId: string;
  activeRunId: string | undefined;
  activeSection: ActivitySection;
  onAttention: (id: string) => void;
  onFile: (file: FileFixture) => void;
  onProject: (projectId: string) => void;
  onRun: (run: RunFixture) => void;
}>) {
  return (
    <aside className={styles["workspace-sidebar"]}>
      <header className={styles["sidebar-header"]}>
        <span>{railLabels[activeSection]}</span>
        <button type="button" aria-label={`More ${railLabels[activeSection]} actions`}>
          <DotsThreeIcon size={18} />
        </button>
      </header>
      <nav aria-label={railLabels[activeSection]} className={styles["sidebar-nav"]}>
        <SidebarContent
          activeProjectId={activeProjectId}
          activeRunId={activeRunId}
          activeSection={activeSection}
          onAttention={onAttention}
          onFile={onFile}
          onProject={onProject}
          onRun={onRun}
        />
      </nav>
    </aside>
  );
}

function FileTab({
  activeFile,
  activeSurface,
  onSurface,
  pinned,
}: Readonly<{
  activeFile: FileFixture | undefined;
  activeSurface: CenterSurface;
  onSurface: (surface: CenterSurface) => void;
  pinned: boolean;
}>) {
  if (activeFile === undefined) {
    return null;
  }
  return (
    <button
      type="button"
      role="tab"
      aria-selected={activeSurface === "file"}
      data-active={activeSurface === "file"}
      onClick={() => onSurface("file")}
    >
      <FileIcon size={15} />
      {activeFile.name}
      {pinned ? (
        <PushPinIcon size={12} weight="fill" />
      ) : (
        <span className={styles["preview-mark"]}>preview</span>
      )}
    </button>
  );
}

function RunTabs({
  activeRun,
  activeSurface,
  onSurface,
}: Readonly<{
  activeRun: RunFixture | undefined;
  activeSurface: CenterSurface;
  onSurface: (surface: CenterSurface) => void;
}>) {
  if (activeRun === undefined) {
    return null;
  }
  return (
    <>
      <button
        type="button"
        role="tab"
        aria-selected={activeSurface === "run"}
        data-active={activeSurface === "run"}
        onClick={() => onSurface("run")}
      >
        <PlayIcon size={15} />
        Run {activeRun.number}
      </button>
      {activeSurface === "changes" ? (
        <button type="button" role="tab" aria-selected="true" data-active="true">
          <GitDiffIcon size={15} /> Changes
        </button>
      ) : null}
    </>
  );
}

function OptionalSurfaceTabs({
  activeSurface,
  onSurface,
  reviewOpen,
}: Readonly<{
  activeSurface: CenterSurface;
  onSurface: (surface: CenterSurface) => void;
  reviewOpen: boolean;
}>) {
  return (
    <>
      {reviewOpen ? (
        <button
          type="button"
          role="tab"
          aria-selected={activeSurface === "review"}
          data-active={activeSurface === "review"}
          onClick={() => onSurface("review")}
        >
          <CheckCircleIcon size={15} /> Frame review
        </button>
      ) : null}
      {activeSurface === "memory" ? (
        <button type="button" role="tab" aria-selected="true" data-active="true">
          <FolderOpenIcon size={15} /> Project Memory
        </button>
      ) : null}
      {activeSurface === "settings" ? (
        <button type="button" role="tab" aria-selected="true" data-active="true">
          <GearSixIcon size={15} /> Settings
        </button>
      ) : null}
    </>
  );
}

export function CenterTabs({
  activeFile,
  activeRun,
  activeSurface,
  onSurface,
  pinned,
  reviewOpen,
}: Readonly<{
  activeFile: FileFixture | undefined;
  activeRun: RunFixture | undefined;
  activeSurface: CenterSurface;
  onSurface: (surface: CenterSurface) => void;
  pinned: boolean;
  reviewOpen: boolean;
}>) {
  return (
    <div className={styles["center-tabs"]} role="tablist" aria-label="Open workspace surfaces">
      <button
        type="button"
        role="tab"
        aria-selected={activeSurface === "map"}
        data-active={activeSurface === "map"}
        onClick={() => onSurface("map")}
      >
        <MapTrifoldIcon size={16} weight={activeSurface === "map" ? "fill" : "regular"} />
        Map
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeSurface === "conversation"}
        data-active={activeSurface === "conversation"}
        onClick={() => onSurface("conversation")}
      >
        <ChatCircleDotsIcon
          size={16}
          weight={activeSurface === "conversation" ? "fill" : "regular"}
        />
        Conversation
      </button>
      <FileTab
        activeFile={activeFile}
        activeSurface={activeSurface}
        onSurface={onSurface}
        pinned={pinned}
      />
      <RunTabs activeRun={activeRun} activeSurface={activeSurface} onSurface={onSurface} />
      <OptionalSurfaceTabs
        activeSurface={activeSurface}
        onSurface={onSurface}
        reviewOpen={reviewOpen}
      />
    </div>
  );
}

export function LogsPanel({
  open,
  onClose,
  onScope,
  scope,
}: Readonly<{
  open: boolean;
  onClose: () => void;
  onScope: (scope: string) => void;
  scope: string;
}>) {
  if (!open) {
    return null;
  }
  return (
    <section className={styles["logs-panel"]} aria-label="Logs and output">
      <header>
        <div>
          <TerminalWindowIcon size={17} />
          <strong>Logs</strong>
          <span>4 events</span>
        </div>
        <div>
          <label>
            <span>Scope</span>
            <select
              aria-label="Log scope"
              value={scope}
              onChange={(event) => onScope(event.target.value)}
            >
              <option value="run-42">Run 42</option>
              <option value="run-41">Run 41</option>
              <option value="project">Project: MaxReps</option>
              <option value="application">Application</option>
            </select>
          </label>
          <button type="button" aria-label="Close logs" onClick={onClose}>
            <XIcon size={16} />
          </button>
        </div>
      </header>
      <pre>{logLines.join("\n")}</pre>
    </section>
  );
}

export function ProjectMenu({
  onClose,
  onMemory,
  onProjectSettings,
}: Readonly<{ onClose: () => void; onMemory: () => void; onProjectSettings: () => void }>) {
  return (
    <div
      className={`${styles["settings-menu"]} ${styles["project-menu"]}`}
      role="menu"
      aria-label="Project menu"
    >
      <header>
        <strong>MaxReps</strong>
        <button type="button" aria-label="Close Project menu" onClick={onClose}>
          <XIcon size={15} />
        </button>
      </header>
      <button type="button" role="menuitem" onClick={onMemory}>
        <FolderOpenIcon size={17} />
        <span>
          <strong>Memory library</strong>
          <small>Accepted, stale, and proposed knowledge</small>
        </span>
      </button>
      <button type="button" role="menuitem" onClick={onProjectSettings}>
        <GearSixIcon size={17} />
        <span>
          <strong>Project settings</strong>
          <small>Defaults and local policy</small>
        </span>
      </button>
    </div>
  );
}

export function SettingsMenu({
  onClose,
  onSelect,
}: Readonly<{ onClose: () => void; onSelect: (scope: SettingsScope) => void }>) {
  return (
    <div className={styles["settings-menu"]} role="menu" aria-label="Settings menu">
      <header>
        <strong>Settings</strong>
        <button type="button" aria-label="Close settings menu" onClick={onClose}>
          <XIcon size={15} />
        </button>
      </header>
      <button type="button" role="menuitem" onClick={() => onSelect("application")}>
        <GearSixIcon size={17} />
        <span>
          <strong>Application</strong>
          <small>Desktop and diagnostics</small>
        </span>
      </button>
      <button type="button" role="menuitem" onClick={() => onSelect("project")}>
        <FolderOpenIcon size={17} />
        <span>
          <strong>Project</strong>
          <small>MaxReps defaults</small>
        </span>
      </button>
      <button type="button" role="menuitem" onClick={() => onSelect("models")}>
        <GraphIcon size={17} />
        <span>
          <strong>Models</strong>
          <small>Catalogue and credentials</small>
        </span>
      </button>
    </div>
  );
}
