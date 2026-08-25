import { CaretDownIcon, MagnifyingGlassIcon, SidebarSimpleIcon } from "@phosphor-icons/react";
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { useState } from "react";
import styles from "./prototype-app.module.css";
import { RightPanel } from "./prototype-context-panel.js";
import { ConversationSurface } from "./prototype-conversation.js";
import {
  type ActivitySection,
  attentionItems,
  type CenterSurface,
  type ConversationMessageFixture,
  contextItems,
  type FileFixture,
  initialConversationMessages,
  projects,
  type RunFixture,
  runs,
  type WaypointFixture,
} from "./prototype-fixtures.js";
import {
  type ContextRecordView,
  conversationBranchById,
  fileById,
  type MapMode,
  mainConversationBranch,
  type RightTab,
  runById,
  type Selection,
  type SettingsScope,
} from "./prototype-model.js";
import {
  ActivityRail,
  CenterTabs,
  LogsPanel,
  ProjectMenu,
  SettingsMenu,
  WorkspaceSidebar,
} from "./prototype-navigation.js";
import { MemoryLibrarySurface, ReviewSurface } from "./prototype-review-memory.js";
import {
  ChangesSurface,
  FileSurface,
  MapSurface,
  RunSurface,
  SettingsSurface,
} from "./prototype-work-surfaces.js";

export function PrototypeApp() {
  const [activeProjectId, setActiveProjectId] = useState("maxreps");
  const [activeSection, setActiveSection] = useState<ActivitySection>("attention");
  const [activeSurface, setActiveSurface] = useState<CenterSurface>("map");
  const [selection, setSelection] = useState<Selection>({ kind: "project", id: "maxreps" });
  const [activeFileId, setActiveFileId] = useState<string>();
  const [pinnedFiles, setPinnedFiles] = useState<readonly string[]>([]);
  const [activeRunId, setActiveRunId] = useState<string>();
  const [mapMode, setMapMode] = useState<MapMode>("topology");
  const [rightTab, setRightTab] = useState<RightTab>("details");
  const [rightOpen, setRightOpen] = useState(true);
  const [rightWidth, setRightWidth] = useState(396);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logScope, setLogScope] = useState("run-42");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [settingsScope, setSettingsScope] = useState<SettingsScope>("application");
  const [conversationBranchId, setConversationBranchId] = useState("project-main");
  const [contextIncludedIds, setContextIncludedIds] = useState<readonly string[]>(() =>
    contextItems.filter((item) => item.defaultIncluded).map((item) => item.id),
  );
  const [attachments, setAttachments] = useState<readonly string[]>([]);
  const [feed, setFeed] = useState<readonly ConversationMessageFixture[]>(
    initialConversationMessages,
  );
  const [latestContextRecord, setLatestContextRecord] = useState<ContextRecordView>();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [activeMemoryId, setActiveMemoryId] = useState<string>();
  const [frameAccepted, setFrameAccepted] = useState(false);

  const activeProject = projects.find((project) => project.id === activeProjectId) ?? projects[0];
  const activeFile = activeFileId === undefined ? undefined : fileById(activeFileId);
  const activeRun = activeRunId === undefined ? undefined : runById(activeRunId);
  const filePinned = activeFile === undefined ? false : pinnedFiles.includes(activeFile.id);
  const conversationBranch = conversationBranchById(conversationBranchId);

  function selectActivity(section: ActivitySection): void {
    setActiveSection(section);
    setSettingsOpen(false);
    setProjectMenuOpen(false);
  }

  function selectProject(projectId: string): void {
    setActiveProjectId(projectId);
    setActiveSection("attention");
    setActiveSurface("map");
    setSelection({ kind: "project", id: projectId });
    setConversationBranchId(mainConversationBranch("project").id);
    setRightTab("details");
  }

  function selectAttention(attentionId: string): void {
    const item = attentionItems.find((candidate) => candidate.id === attentionId);
    if (item === undefined) {
      return;
    }
    if (item.kind === "review") {
      const run = runs.find((candidate) => candidate.waypointId === item.waypointId);
      if (run !== undefined) {
        setActiveRunId(run.id);
        setActiveSurface("changes");
        setSelection({ kind: "changes", id: run.id });
      }
    } else {
      setActiveSurface("map");
      setSelection({ kind: "waypoint", id: item.waypointId });
    }
    setConversationBranchId(mainConversationBranch(`waypoint:${item.waypointId}`).id);
    setRightTab("details");
    setRightOpen(true);
  }

  function selectWaypoint(waypoint: WaypointFixture): void {
    setSelection({ kind: "waypoint", id: waypoint.id });
    setConversationBranchId(mainConversationBranch(`waypoint:${waypoint.id}`).id);
    setRightTab("details");
    setRightOpen(true);
  }

  function openFile(file: FileFixture): void {
    setActiveFileId(file.id);
    setActiveSurface("file");
    setSelection({ kind: "file", id: file.id });
    setRightTab("details");
    setRightOpen(true);
  }

  function openRun(run: RunFixture): void {
    setActiveRunId(run.id);
    setActiveSurface("run");
    setSelection({ kind: "run", id: run.id });
    setConversationBranchId(mainConversationBranch(`waypoint:${run.waypointId}`).id);
    setRightTab("details");
    setRightOpen(true);
  }

  function openChanges(run: RunFixture): void {
    setActiveRunId(run.id);
    setActiveSurface("changes");
    setSelection({ kind: "changes", id: run.id });
    setRightTab("changes");
    setRightOpen(true);
  }

  function openSettings(scope: SettingsScope): void {
    setSettingsScope(scope);
    setSettingsOpen(false);
    setActiveSurface("settings");
    setSelection({ kind: "project", id: activeProjectId });
  }

  function openCenterSurface(surface: CenterSurface): void {
    setActiveSurface(surface);
    setProjectMenuOpen(false);
    if (surface === "conversation") {
      setRightOpen(false);
    }
    if (surface === "map") {
      setRightOpen(true);
    }
    if (surface === "review") {
      setReviewOpen(true);
      setRightOpen(false);
    }
  }

  function openReview(): void {
    setReviewOpen(true);
    setActiveSurface("review");
    setRightOpen(false);
  }

  function openMemory(memoryId?: string): void {
    setActiveMemoryId(memoryId);
    setProjectMenuOpen(false);
    setActiveSurface("memory");
    setRightOpen(false);
  }

  function returnToConversation(): void {
    setActiveSurface("conversation");
    setRightOpen(false);
  }

  function acceptFrame(): void {
    setFrameAccepted(true);
    setActiveSurface("map");
    setSelection({ kind: "project", id: activeProjectId });
    setRightOpen(true);
  }

  function togglePin(): void {
    if (activeFile === undefined) {
      return;
    }
    setPinnedFiles((current) =>
      current.includes(activeFile.id)
        ? current.filter((id) => id !== activeFile.id)
        : [...current, activeFile.id],
    );
  }

  function attachCurrentFile(): void {
    if (activeFile === undefined || attachments.includes(activeFile.name)) {
      return;
    }
    setAttachments((current) => [...current, activeFile.name]);
  }

  function sendMessage(body: string): void {
    const recordId = `context-${feed.length + 1}`;
    const includedIds = [...contextIncludedIds];
    const excludedIds = contextItems
      .filter((item) => !includedIds.includes(item.id))
      .map((item) => item.id);
    setLatestContextRecord({ id: recordId, includedIds, excludedIds });
    setFeed((current) => [
      ...current,
      {
        id: `local-${current.length}`,
        author: "You",
        time: "now",
        body,
        kind: "user",
        branchId: conversationBranch.id,
      },
      {
        id: `local-${current.length + 1}`,
        author: "Frame guide",
        time: "now",
        body: "The failure remains a separate observable outcome.",
        kind: "agent",
        branchId: conversationBranch.id,
        contextRecordId: recordId,
      },
    ]);
  }

  function startPanelResize(event: ReactPointerEvent<HTMLHRElement>): void {
    const handle = event.currentTarget;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startWidth = rightWidth;
    handle.setPointerCapture(pointerId);
    function move(moveEvent: PointerEvent): void {
      const maximum = Math.min(window.innerWidth * 0.55, 620);
      setRightWidth(Math.max(320, Math.min(maximum, startWidth + startX - moveEvent.clientX)));
    }
    function stop(): void {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", stop);
      handle.removeEventListener("pointercancel", stop);
    }
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);
  }

  function resizeWithKeyboard(event: KeyboardEvent<HTMLHRElement>): void {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }
    event.preventDefault();
    setRightWidth((current) =>
      Math.max(320, Math.min(620, current + (event.key === "ArrowLeft" ? 24 : -24))),
    );
  }

  return (
    <main className={styles["prototype-shell"]}>
      <ActivityRail
        activeSection={activeSection}
        onSection={selectActivity}
        onDiagnostics={() => {
          setLogsOpen(true);
          setLogScope("application");
        }}
        onSettings={() => setSettingsOpen((current) => !current)}
      />
      <header className={styles["top-bar"]}>
        <div className={styles["project-identity"]}>
          <button
            type="button"
            className={styles["project-menu-button"]}
            aria-label="Open Project menu"
            aria-expanded={projectMenuOpen}
            onClick={() => {
              setProjectMenuOpen((current) => !current);
              setSettingsOpen(false);
            }}
          >
            <strong>{activeProject?.name ?? "Project unavailable"}</strong>
            <CaretDownIcon size={13} />
          </button>
          <span>{activeProject?.repository}</span>
          <span className={styles["branch-label"]}>{activeProject?.branch}</span>
        </div>
        <div className={styles["top-status"]}>
          <span>
            <i data-tone="success" /> Local writer
          </span>
          <span>
            <i data-tone="active" /> {activeProject?.activeRuns ?? 0} active Runs
          </span>
          <button type="button" aria-label="Search Project">
            <MagnifyingGlassIcon size={17} />
          </button>
          {!rightOpen ? (
            <button
              type="button"
              aria-label="Open context panel"
              onClick={() => setRightOpen(true)}
            >
              <SidebarSimpleIcon size={18} />
            </button>
          ) : null}
        </div>
      </header>
      <WorkspaceSidebar
        activeProjectId={activeProjectId}
        activeRunId={activeRunId}
        activeSection={activeSection}
        onProject={selectProject}
        onAttention={selectAttention}
        onFile={openFile}
        onRun={openRun}
      />
      <section className={styles["center-workspace"]}>
        <CenterTabs
          activeFile={activeFile}
          activeRun={activeRun}
          activeSurface={activeSurface}
          pinned={filePinned}
          reviewOpen={reviewOpen}
          onSurface={openCenterSurface}
        />
        <div className={styles["center-content"]}>
          {activeSurface === "map" ? (
            <MapSurface
              frameAccepted={frameAccepted}
              mapMode={mapMode}
              onMapMode={setMapMode}
              onSelectWaypoint={selectWaypoint}
            />
          ) : null}
          {activeSurface === "conversation" ? (
            <ConversationSurface
              attachments={attachments}
              branch={conversationBranch}
              contextIncludedIds={contextIncludedIds}
              feed={feed}
              latestRecord={latestContextRecord}
              selection={selection}
              onAddAttachment={attachCurrentFile}
              onBranch={(branch) => setConversationBranchId(branch.id)}
              onContextSelection={setContextIncludedIds}
              onOpenMemory={openMemory}
              onOpenReview={openReview}
              onSend={sendMessage}
            />
          ) : null}
          {activeSurface === "file" && activeFile !== undefined ? (
            <FileSurface file={activeFile} pinned={filePinned} onPin={togglePin} />
          ) : null}
          {activeSurface === "run" && activeRun !== undefined ? (
            <RunSurface
              run={activeRun}
              onChanges={() => openChanges(activeRun)}
              onLogs={() => {
                setLogScope(activeRun.id);
                setLogsOpen(true);
              }}
            />
          ) : null}
          {activeSurface === "changes" && activeRun !== undefined ? (
            <ChangesSurface run={activeRun} />
          ) : null}
          {activeSurface === "review" ? (
            <ReviewSurface onAccept={acceptFrame} onReturn={returnToConversation} />
          ) : null}
          {activeSurface === "memory" ? (
            <MemoryLibrarySurface activeMemoryId={activeMemoryId} onReturn={returnToConversation} />
          ) : null}
          {activeSurface === "settings" ? <SettingsSurface scope={settingsScope} /> : null}
        </div>
        <LogsPanel
          open={logsOpen}
          scope={logScope}
          onScope={setLogScope}
          onClose={() => setLogsOpen(false)}
        />
      </section>
      <RightPanel
        open={rightOpen}
        rightTab={rightTab}
        selection={selection}
        width={rightWidth}
        onClose={() => setRightOpen(false)}
        onResizeKeyDown={resizeWithKeyboard}
        onResizeStart={startPanelResize}
        onTab={setRightTab}
      />
      {settingsOpen ? (
        <SettingsMenu onClose={() => setSettingsOpen(false)} onSelect={openSettings} />
      ) : null}
      {projectMenuOpen ? (
        <ProjectMenu
          onClose={() => setProjectMenuOpen(false)}
          onMemory={() => openMemory()}
          onProjectSettings={() => openSettings("project")}
        />
      ) : null}
    </main>
  );
}
