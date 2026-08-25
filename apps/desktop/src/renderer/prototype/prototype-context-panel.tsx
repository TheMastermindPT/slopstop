import { CheckCircleIcon, SidebarSimpleIcon, WarningCircleIcon } from "@phosphor-icons/react";
import type { ComponentType, KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import styles from "./prototype-app.module.css";
import {
  fileById,
  type RightTab,
  runById,
  type Selection,
  waypointById,
} from "./prototype-model.js";

type SelectionSummary = Readonly<{
  label: string;
  title: string;
  status: string;
  tone: string;
}>;

function waypointSummary(id: string): SelectionSummary {
  const waypoint = waypointById(id);
  return {
    label: waypoint?.feature ?? "Waypoint",
    title: waypoint?.shortTitle ?? "Unknown Waypoint",
    status: waypoint?.statusLabel ?? "Unavailable",
    tone: waypoint?.status ?? "blocked",
  };
}

function fileSummary(id: string): SelectionSummary {
  const file = fileById(id);
  return {
    label: file?.path ?? "Project file",
    title: file?.name ?? "Unknown file",
    status: file?.changed ? "Modified by Run 42" : "Current source",
    tone: file?.changed ? "active" : "ready",
  };
}

function runSummary(id: string): SelectionSummary {
  const run = runById(id);
  return {
    label: run === undefined ? "Run" : `Run ${run.number}`,
    title: run?.title ?? "Unknown Run",
    status: run?.statusLabel ?? "Unavailable",
    tone: run?.status ?? "blocked",
  };
}

function changesSummary(id: string): SelectionSummary {
  const run = runById(id);
  return {
    label: run === undefined ? "Changes" : `Run ${run.number} changes`,
    title: run?.changeState === "candidate" ? "Candidate delta" : "Live Worker delta",
    status: run?.changeState === "candidate" ? "Ready for review" : "Provisional · read-only",
    tone: run?.changeState === "candidate" ? "ready" : "active",
  };
}

function projectSummary(): SelectionSummary {
  return {
    label: "Active Project",
    title: "MaxReps",
    status: "3 items need you",
    tone: "attention",
  };
}

const summaryByKind: Record<Selection["kind"], (id: string) => SelectionSummary> = {
  project: projectSummary,
  waypoint: waypointSummary,
  file: fileSummary,
  run: runSummary,
  changes: changesSummary,
};

function selectionSummary(selection: Selection): SelectionSummary {
  return summaryByKind[selection.kind](selection.id);
}

function DetailsPage({ summary }: Readonly<{ summary: SelectionSummary }>) {
  return (
    <>
      <h2>Exact context</h2>
      <dl>
        <div>
          <dt>Identity</dt>
          <dd>{summary.title}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{summary.status}</dd>
        </div>
        <div>
          <dt>Authority</dt>
          <dd>Application coordinator</dd>
        </div>
        <div>
          <dt>Revision</dt>
          <dd>625137c</dd>
        </div>
      </dl>
    </>
  );
}

function EvidencePage() {
  return (
    <>
      <h2>Evidence</h2>
      <div className={styles["evidence-row"]}>
        <CheckCircleIcon size={18} weight="fill" />
        <span>
          <strong>Unit contract</strong>
          <small>Accepted · current revision</small>
        </span>
      </div>
      <div className={styles["evidence-row"]}>
        <WarningCircleIcon size={18} />
        <span>
          <strong>Suspension proof</strong>
          <small>Broken · recovery required</small>
        </span>
      </div>
    </>
  );
}

function ChangesPage() {
  return (
    <>
      <h2>Change provenance</h2>
      <p>
        2 files changed by attributed Workers. No active Worker change is eligible for Integration.
      </p>
      <button type="button" className={styles["primary-button"]}>
        Open exact delta
      </button>
    </>
  );
}

const contextPageByTab: Record<RightTab, ComponentType<Readonly<{ summary: SelectionSummary }>>> = {
  details: DetailsPage,
  evidence: EvidencePage,
  changes: ChangesPage,
};

function ContextPage({
  rightTab,
  summary,
}: Readonly<{ rightTab: RightTab; summary: SelectionSummary }>) {
  const ActiveContextPage = contextPageByTab[rightTab];
  return <ActiveContextPage summary={summary} />;
}

export function RightPanel({
  onClose,
  onResizeKeyDown,
  onResizeStart,
  onTab,
  open,
  rightTab,
  selection,
  width,
}: Readonly<{
  onClose: () => void;
  onResizeKeyDown: (event: KeyboardEvent<HTMLHRElement>) => void;
  onResizeStart: (event: ReactPointerEvent<HTMLHRElement>) => void;
  onTab: (tab: RightTab) => void;
  open: boolean;
  rightTab: RightTab;
  selection: Selection;
  width: number;
}>) {
  if (!open) {
    return null;
  }
  const summary = selectionSummary(selection);
  return (
    <aside
      className={styles["right-panel"]}
      aria-label="Context workbench"
      style={{ width: `${width}px` }}
    >
      <hr
        className={styles["resize-handle"]}
        aria-label="Resize context panel"
        aria-orientation="vertical"
        aria-valuemin={320}
        aria-valuemax={620}
        aria-valuenow={width}
        tabIndex={0}
        onKeyDown={onResizeKeyDown}
        onPointerDown={onResizeStart}
      />
      <header className={styles["right-summary"]}>
        <div>
          <span>{summary.label}</span>
          <strong>{summary.title}</strong>
        </div>
        <button type="button" aria-label="Collapse context panel" onClick={onClose}>
          <SidebarSimpleIcon size={18} />
        </button>
        <p data-tone={summary.tone}>
          <i /> {summary.status}
        </p>
      </header>
      <div className={styles["right-tabs"]} role="tablist" aria-label="Context pages">
        {(["details", "evidence", "changes"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={rightTab === tab}
            data-active={rightTab === tab}
            onClick={() => onTab(tab)}
          >
            {tab[0]?.toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>
      <div className={styles["context-page"]}>
        <ContextPage rightTab={rightTab} summary={summary} />
      </div>
    </aside>
  );
}
