import {
  ArrowSquareOutIcon,
  CheckCircleIcon,
  FileIcon,
  GitDiffIcon,
  GraphIcon,
  ListBulletsIcon,
  PulseIcon,
  PushPinIcon,
  TerminalWindowIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import styles from "./prototype-app.module.css";
import {
  type FileFixture,
  type RunFixture,
  type WaypointFixture,
  waypoints,
} from "./prototype-fixtures.js";
import { type MapMode, type SettingsScope, waypointById } from "./prototype-model.js";

function MapHeader({
  frameAccepted,
  mapMode,
  onMapMode,
}: Readonly<{
  frameAccepted: boolean;
  mapMode: MapMode;
  onMapMode: (mode: MapMode) => void;
}>) {
  return (
    <header className={styles["surface-heading"]}>
      <div>
        <span>MaxReps / Workout continuity</span>
        <h1 id="map-title">Relationship map</h1>
        <p>Human attention is framed; active work remains visible without becoming priority.</p>
        {frameAccepted ? (
          <div className={styles["accepted-revision"]} role="status">
            <CheckCircleIcon size={16} weight="fill" />
            <span>
              <strong>Accepted revision generated this map</strong>
              <small>Revision 03 · 4 Waypoints and 4 relationships framed</small>
            </span>
          </div>
        ) : null}
      </div>
      <fieldset className={styles["segmented-control"]}>
        <legend className={styles["visually-hidden"]}>Map projection</legend>
        <button
          type="button"
          data-active={mapMode === "topology"}
          aria-pressed={mapMode === "topology"}
          onClick={() => onMapMode("topology")}
        >
          <GraphIcon size={16} />
          Topology
        </button>
        <button
          type="button"
          data-active={mapMode === "list"}
          aria-pressed={mapMode === "list"}
          onClick={() => onMapMode("list")}
        >
          <ListBulletsIcon size={16} />
          Text view
        </button>
      </fieldset>
    </header>
  );
}

function CircuitLines() {
  return (
    <svg
      className={styles["circuit-lines"]}
      viewBox="0 0 1000 650"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <marker
          id="skill-arrow-1"
          viewBox="0 0 8 8"
          refX="7"
          refY="4"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M0 0 L8 4 L0 8 Z" fill="#d8dedb" />
        </marker>
      </defs>
      <path
        className={`${styles["relation-edge"]} ${styles["relation-related"]}`}
        d="M500 552 L500 430 L220 430 L220 338"
      />
      <path
        className={`${styles["relation-edge"]} ${styles["relation-derived"]}`}
        d="M500 552 L500 430 L780 430 L780 338"
      />
      <path
        className={`${styles["relation-edge"]} ${styles["relation-blocks"]}`}
        markerEnd="url(#skill-arrow-1)"
        d="M220 338 L220 225 L500 225 L500 108"
      />
      <path
        className={`${styles["relation-edge"]} ${styles["relation-blocks"]}`}
        markerEnd="url(#skill-arrow-1)"
        d="M780 338 L780 225 L500 225 L500 108"
      />
    </svg>
  );
}

function RelationshipLegend() {
  return (
    <section className={styles["relation-legend"]} aria-label="Relationship legend">
      <span>
        <i className={styles["legend-blocks"]} /> blocks
      </span>
      <span>
        <i className={styles["legend-related"]} /> related-to
      </span>
      <span>
        <i className={styles["legend-derived"]} /> derived-from
      </span>
    </section>
  );
}

function CircuitMap({
  onSelectWaypoint,
}: Readonly<{ onSelectWaypoint: (waypoint: WaypointFixture) => void }>) {
  return (
    <div className={styles["circuit-map"]} role="tree" aria-label="Carbon circuit skill tree">
      <div className={styles["carbon-field"]} aria-hidden="true" />
      <div className={styles["circuit-canvas"]}>
        <span className={styles["circuit-branch-label"]}>Continuity branch</span>
        <span className={styles["circuit-branch-label"]}>Recovery branch</span>
        <CircuitLines />
        {waypoints.map((waypoint) => (
          <button
            key={waypoint.id}
            type="button"
            role="treeitem"
            className={styles["circuit-node"]}
            data-waypoint={waypoint.id}
            data-status={waypoint.status}
            onClick={() => onSelectWaypoint(waypoint)}
          >
            <span className={styles["circuit-sigil"]}>
              <span>{waypoint.shortTitle.slice(0, 2).toUpperCase()}</span>
            </span>
            <strong>{waypoint.shortTitle}</strong>
            <small>{waypoint.statusLabel}</small>
          </button>
        ))}
      </div>
      <div className={styles["carbon-smoke"]} aria-hidden="true">
        <span />
      </div>
      <RelationshipLegend />
    </div>
  );
}

function MapList({
  onSelectWaypoint,
}: Readonly<{ onSelectWaypoint: (waypoint: WaypointFixture) => void }>) {
  return (
    <div className={styles["map-list"]}>
      {waypoints.map((waypoint) => (
        <button key={waypoint.id} type="button" onClick={() => onSelectWaypoint(waypoint)}>
          <span className={styles["status-dot"]} data-status={waypoint.status} />
          <span>
            <strong>{waypoint.title}</strong>
            <small>{waypoint.objective}</small>
          </span>
          <span>{waypoint.statusLabel}</span>
        </button>
      ))}
    </div>
  );
}

export function MapSurface({
  frameAccepted,
  mapMode,
  onMapMode,
  onSelectWaypoint,
}: Readonly<{
  frameAccepted: boolean;
  mapMode: MapMode;
  onMapMode: (mode: MapMode) => void;
  onSelectWaypoint: (waypoint: WaypointFixture) => void;
}>) {
  return (
    <section className={styles["map-surface"]} aria-labelledby="map-title">
      <MapHeader frameAccepted={frameAccepted} mapMode={mapMode} onMapMode={onMapMode} />
      {mapMode === "topology" ? (
        <CircuitMap onSelectWaypoint={onSelectWaypoint} />
      ) : (
        <MapList onSelectWaypoint={onSelectWaypoint} />
      )}
    </section>
  );
}

export function FileSurface({
  file,
  pinned,
  onPin,
}: Readonly<{
  file: FileFixture;
  pinned: boolean;
  onPin: () => void;
}>) {
  return (
    <section className={styles["file-surface"]} aria-labelledby="file-title">
      <header className={styles["surface-heading"]}>
        <div>
          <span>{file.path}</span>
          <h1 id="file-title">{file.name}</h1>
          <p>{file.language ?? "External preview required"}</p>
        </div>
        <div className={styles["surface-actions"]}>
          <button type="button" className={styles["quiet-button"]} onClick={onPin}>
            <PushPinIcon size={16} weight={pinned ? "fill" : "regular"} />
            {pinned ? "Unpin file" : "Pin file"}
          </button>
          <button type="button" className={styles["quiet-button"]}>
            <ArrowSquareOutIcon size={16} />
            Open in external editor
          </button>
        </div>
      </header>
      {file.unsupportedReason === undefined ? (
        <div className={styles["source-view"]}>
          <div className={styles["source-gutter"]} aria-hidden="true">
            {(file.source ?? "").split("\n").map((_line, index) => (
              <span key={`${file.id}-${index}`}>{index + 1}</span>
            ))}
          </div>
          <pre>
            <code>{file.source}</code>
          </pre>
        </div>
      ) : (
        <div className={styles["unsupported-file"]}>
          <WarningCircleIcon size={30} />
          <div>
            <strong>Preview unavailable</strong>
            <p>{file.unsupportedReason}</p>
            <small>Binary file · 18.4 MB · content was not partially loaded</small>
          </div>
          <button type="button" className={styles["primary-button"]}>
            Open in external editor
          </button>
        </div>
      )}
    </section>
  );
}

function RunPulse({ run }: Readonly<{ run: RunFixture }>) {
  const waypoint = waypointById(run.waypointId);
  return (
    <section className={styles["run-pulse"]}>
      <div className={styles["run-pulse-indicator"]} data-status={run.status}>
        <span />
      </div>
      <div>
        <span>{run.status === "active" ? "Supervised execution" : "Execution settled"}</span>
        <strong>{run.statusLabel}</strong>
        <p>{waypoint?.objective}</p>
      </div>
    </section>
  );
}

function RunMeasures({ run }: Readonly<{ run: RunFixture }>) {
  return (
    <dl className={styles["run-measures"]}>
      <div>
        <dt>Progress</dt>
        <dd>{run.progress}</dd>
      </div>
      <div>
        <dt>Elapsed</dt>
        <dd>{run.elapsed}</dd>
      </div>
      <div>
        <dt>Budget</dt>
        <dd>{run.budget}</dd>
      </div>
    </dl>
  );
}

function TaskFlow({ run }: Readonly<{ run: RunFixture }>) {
  return (
    <section className={styles["task-flow"]}>
      <header>
        <h2>Execution flow</h2>
        <span>{run.workers.length} attributed Workers</span>
      </header>
      {run.workers.map((worker, index) => {
        const settled = run.status === "review" || index < 2;
        return (
          <div
            key={worker}
            className={styles["task-row"]}
            data-state={settled ? "settled" : "active"}
          >
            {settled ? <CheckCircleIcon size={18} weight="fill" /> : <PulseIcon size={18} />}
            <span>
              <strong>{worker}</strong>
              <small>{settled ? "Evidence recorded" : "Working in isolated workspace"}</small>
            </span>
            <time>{settled ? `${6 + index * 4}m` : "now"}</time>
          </div>
        );
      })}
    </section>
  );
}

export function RunSurface({
  run,
  onChanges,
  onLogs,
}: Readonly<{ run: RunFixture; onChanges: () => void; onLogs: () => void }>) {
  const waypoint = waypointById(run.waypointId);
  return (
    <section className={styles["run-surface"]} aria-labelledby="run-title">
      <header className={styles["surface-heading"]}>
        <div>
          <span>
            {waypoint?.feature ?? "Waypoint"} / {run.status === "active" ? "Executing" : "Review"}
          </span>
          <h1 id="run-title">Run {run.number}</h1>
          <p>{run.title}</p>
        </div>
        <div className={styles["surface-actions"]}>
          <button type="button" className={styles["quiet-button"]} onClick={onLogs}>
            <TerminalWindowIcon size={16} />
            Open logs
          </button>
          <button type="button" className={styles["primary-button"]} onClick={onChanges}>
            <GitDiffIcon size={17} />
            {run.changeState === "provisional" ? "View live changes" : "Review candidate"}
          </button>
        </div>
      </header>
      <div className={styles["run-overview"]}>
        <RunPulse run={run} />
        <RunMeasures run={run} />
        <TaskFlow run={run} />
      </div>
    </section>
  );
}

export function ChangesSurface({ run }: Readonly<{ run: RunFixture }>) {
  const candidate = run.changeState === "candidate";
  return (
    <section className={styles["changes-surface"]} aria-labelledby="changes-title">
      <header className={styles["surface-heading"]}>
        <div>
          <span>Run {run.number} / 2 files changed / +31 -12</span>
          <h1 id="changes-title">{candidate ? "Candidate delta ready" : "Provisional diff"}</h1>
          <p>
            {candidate
              ? "Independent validation passed. Review the exact delta before Integration."
              : "Worker output is still changing. Review is read-only until the delta closes."}
          </p>
        </div>
        <div className={styles["surface-actions"]}>
          <button type="button" className={styles["quiet-button"]}>
            Request changes
          </button>
          {candidate ? (
            <button type="button" className={styles["primary-button"]}>
              Approve integration
            </button>
          ) : null}
        </div>
      </header>
      <div className={styles["change-layout"]}>
        <nav className={styles["changed-files"]} aria-label="Changed files">
          <strong>Changed files</strong>
          <button type="button" data-active="true">
            <FileIcon size={15} />
            <span>session-store.ts</span>
            <small>+18 -4</small>
          </button>
          <button type="button">
            <FileIcon size={15} />
            <span>timer-reducer.ts</span>
            <small>+13 -8</small>
          </button>
        </nav>
        <div className={styles["diff-view"]}>
          <header>
            <span>src/features/session-store.ts</span>
            <span>{candidate ? "Validated at 19:01" : "Updated 12s ago"}</span>
          </header>
          <section aria-label="Source diff">
            <pre>
              <code>
                <span className={styles["diff-context"]}>
                  {" "}
                  export function restoreSession(snapshot, now) {"{"}
                </span>
                <span className={styles["diff-removed"]}>
                  - const remaining = snapshot.remainingMs;
                </span>
                <span className={styles["diff-added"]}>
                  + const elapsed = now.epochMs - snapshot.startedAt.epochMs;
                </span>
                <span className={styles["diff-added"]}>
                  + const remaining = Math.max(0, snapshot.durationMs - elapsed);
                </span>
                <span className={styles["diff-context"]}> return {"{"}</span>
                <span className={styles["diff-context"]}> ...snapshot.session,</span>
                <span className={styles["diff-removed"]}>- remainingMs: remaining,</span>
                <span className={styles["diff-added"]}>+ remainingMs: remaining,</span>
                <span className={styles["diff-added"]}>+ restoredFrom: snapshot.id,</span>
                <span className={styles["diff-context"]}> {"}"};</span>
                <span className={styles["diff-context"]}> {"}"}</span>
              </code>
            </pre>
          </section>
        </div>
      </div>
    </section>
  );
}

const settingsCopy: Record<SettingsScope, Readonly<{ title: string; detail: string }>> = {
  application: {
    title: "Application settings",
    detail: "Local behavior, diagnostics consent, and desktop preferences.",
  },
  project: {
    title: "Project settings",
    detail: "Defaults and restrictions that apply only to MaxReps.",
  },
  models: {
    title: "Models",
    detail: "Provider catalogue and credentials. Run overrides remain visible at dispatch.",
  },
};

export function SettingsSurface({ scope }: Readonly<{ scope: SettingsScope }>) {
  const copy = settingsCopy[scope];
  const modelScope = scope === "models";
  return (
    <section className={styles["settings-surface"]} aria-labelledby="settings-title">
      <header className={styles["surface-heading"]}>
        <div>
          <span>Settings / {scope}</span>
          <h1 id="settings-title">{copy.title}</h1>
          <p>{copy.detail}</p>
        </div>
      </header>
      <div className={styles["settings-form"]}>
        <section>
          <div>
            <strong>{modelScope ? "Default implementation model" : "Supervision density"}</strong>
            <p>
              {modelScope
                ? "Used only when a Run does not declare a role or task override."
                : "Choose how much live operational detail appears before you ask for it."}
            </p>
          </div>
          <select aria-label={modelScope ? "Default implementation model" : "Supervision density"}>
            {modelScope ? (
              <>
                <option>Claude Sonnet 4.5</option>
                <option>GPT-5.6</option>
              </>
            ) : (
              <>
                <option>Balanced</option>
                <option>Compact</option>
                <option>Detailed</option>
              </>
            )}
          </select>
        </section>
        <section>
          <div>
            <strong>Explicit changes only</strong>
            <p>
              Model and policy changes create reviewed proposals and never affect active Workers.
            </p>
          </div>
          <button type="button" className={styles["toggle"]} aria-pressed="true">
            <span /> On
          </button>
        </section>
      </div>
    </section>
  );
}
