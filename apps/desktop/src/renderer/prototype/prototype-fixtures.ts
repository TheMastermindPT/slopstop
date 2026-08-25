export type ActivitySection = "projects" | "attention" | "files" | "runs";
export type CenterSurface =
  | "map"
  | "conversation"
  | "file"
  | "run"
  | "changes"
  | "review"
  | "memory"
  | "settings";
type AttentionKind = "decision" | "recovery" | "review";
type WaypointStatus = "attention" | "active" | "blocked" | "ready";

export type ProjectFixture = Readonly<{
  id: string;
  name: string;
  repository: string;
  branch: string;
  attentionCount: number;
  activeRuns: number;
}>;

export type AttentionFixture = Readonly<{
  id: string;
  kind: AttentionKind;
  title: string;
  detail: string;
  waypointId: string;
  age: string;
  impact: "critical" | "high" | "normal";
}>;

export type WaypointFixture = Readonly<{
  id: string;
  feature: string;
  title: string;
  shortTitle: string;
  status: WaypointStatus;
  statusLabel: string;
  x: number;
  y: number;
  objective: string;
  currentRun?: string;
}>;

export type FileFixture = Readonly<{
  id: string;
  name: string;
  path: string;
  depth: number;
  kind: "folder" | "file";
  language?: string;
  changed?: boolean;
  unsupportedReason?: string;
  source?: string;
}>;

export type RunFixture = Readonly<{
  id: string;
  number: number;
  waypointId: string;
  title: string;
  status: "active" | "review";
  statusLabel: string;
  progress: string;
  elapsed: string;
  budget: string;
  workers: readonly string[];
  changeState: "provisional" | "candidate";
}>;

export type ConversationMessageFixture = Readonly<{
  id: string;
  author: string;
  time: string;
  body: string;
  kind: "user" | "agent";
  branchId: string;
  contextRecordId?: string;
}>;

export type ConversationBranchFixture = Readonly<{
  id: string;
  scopeId: string;
  label: string;
  pathLabel: string;
  depth: number;
}>;

export type ContextItemFixture = Readonly<{
  id: string;
  label: string;
  detail: string;
  source: "scope" | "decision" | "branch" | "memory" | "source";
  defaultIncluded: boolean;
}>;

export type MemoryFixture = Readonly<{
  id: string;
  title: string;
  summary: string;
  status: "accepted" | "stale" | "proposal";
  provenance: string;
}>;

export const projects: readonly ProjectFixture[] = [
  {
    id: "maxreps",
    name: "MaxReps",
    repository: "TheMastermindPT/maxreps",
    branch: "feature/rest-timer",
    attentionCount: 3,
    activeRuns: 2,
  },
  {
    id: "slopstop",
    name: "SlopStop",
    repository: "TheMastermindPT/slopstop",
    branch: "main",
    attentionCount: 1,
    activeRuns: 1,
  },
];

export const attentionItems: readonly AttentionFixture[] = [
  {
    id: "recover-validation",
    kind: "recovery",
    title: "Validation lost contact",
    detail: "Worker 3 stopped after the browser-suspension probe. Recovery needs confirmation.",
    waypointId: "browser-suspension",
    age: "18m",
    impact: "critical",
  },
  {
    id: "storage-decision",
    kind: "decision",
    title: "Choose resume boundary",
    detail: "The timer can restore from the accepted session snapshot or recompute from wall time.",
    waypointId: "session-storage",
    age: "31m",
    impact: "high",
  },
  {
    id: "candidate-review",
    kind: "review",
    title: "Candidate delta ready",
    detail: "Run 41 passed independent validation and is waiting for integration review.",
    waypointId: "timer-engine",
    age: "44m",
    impact: "normal",
  },
];

export const waypoints: readonly WaypointFixture[] = [
  {
    id: "session-storage",
    feature: "Workout continuity",
    title: "Persist the active rest session",
    shortTitle: "Session storage",
    status: "attention",
    statusLabel: "Decision required",
    x: 18,
    y: 34,
    objective: "Restore the same rest timer after refresh, reopen, and browser suspension.",
    currentRun: "run-42",
  },
  {
    id: "timer-engine",
    feature: "Workout continuity",
    title: "Keep timer state deterministic",
    shortTitle: "Timer engine",
    status: "ready",
    statusLabel: "Ready for review",
    x: 48,
    y: 18,
    objective: "Derive elapsed and remaining time from one durable, testable clock model.",
    currentRun: "run-41",
  },
  {
    id: "browser-suspension",
    feature: "Recovery proof",
    title: "Survive browser suspension",
    shortTitle: "Suspension proof",
    status: "blocked",
    statusLabel: "Recovery required",
    x: 68,
    y: 48,
    objective: "Prove resume behavior after the browser freezes and restores the application.",
  },
  {
    id: "resume-evidence",
    feature: "Recovery proof",
    title: "Record resume evidence",
    shortTitle: "Resume evidence",
    status: "active",
    statusLabel: "Worker active",
    x: 37,
    y: 70,
    objective: "Bind the recovery result to the exact candidate revision and scenario.",
    currentRun: "run-42",
  },
];

export const files: readonly FileFixture[] = [
  { id: "src", name: "src", path: "src", depth: 0, kind: "folder" },
  {
    id: "features",
    name: "features",
    path: "src/features",
    depth: 1,
    kind: "folder",
  },
  {
    id: "session-store",
    name: "session-store.ts",
    path: "src/features/session-store.ts",
    depth: 2,
    kind: "file",
    language: "TypeScript",
    changed: true,
    source: `export function restoreSession(snapshot: SessionSnapshot, now: Instant): RestSession {
  const elapsed = now.epochMs - snapshot.startedAt.epochMs;

  return {
    ...snapshot.session,
    remainingMs: Math.max(0, snapshot.durationMs - elapsed),
    restoredFrom: snapshot.id,
  };
}`,
  },
  {
    id: "timer-reducer",
    name: "timer-reducer.ts",
    path: "src/features/timer-reducer.ts",
    depth: 2,
    kind: "file",
    language: "TypeScript",
    changed: true,
    source: `export function reduceTimer(state: TimerState, event: TimerEvent): TimerState {
  switch (event.type) {
    case "tick":
      return advanceTimer(state, event.now);
    case "restore":
      return restoreTimer(state, event.snapshot, event.now);
  }
}`,
  },
  {
    id: "session-test",
    name: "session-store.test.ts",
    path: "src/features/session-store.test.ts",
    depth: 2,
    kind: "file",
    language: "TypeScript",
    source: `it("restores the remaining interval from elapsed wall time", () => {
  const restored = restoreSession(snapshot, instant("2026-08-22T19:04:00Z"));
  expect(restored.remainingMs).toBe(36_000);
});`,
  },
  { id: "assets", name: "assets", path: "assets", depth: 0, kind: "folder" },
  {
    id: "workout-video",
    name: "rest-demo.mp4",
    path: "assets/rest-demo.mp4",
    depth: 1,
    kind: "file",
    unsupportedReason: "Binary video preview is not available in this prototype.",
  },
];

export const runs: readonly RunFixture[] = [
  {
    id: "run-42",
    number: 42,
    waypointId: "session-storage",
    title: "Restore active rest sessions",
    status: "active",
    statusLabel: "3 of 5 tasks complete",
    progress: "60%",
    elapsed: "12m 48s",
    budget: "$0.87 / $2.40",
    workers: ["Implementer", "Test author", "Repository reader"],
    changeState: "provisional",
  },
  {
    id: "run-41",
    number: 41,
    waypointId: "timer-engine",
    title: "Make timer transitions deterministic",
    status: "review",
    statusLabel: "Candidate ready",
    progress: "5 of 5",
    elapsed: "28m 03s",
    budget: "$1.63 / $2.40",
    workers: ["Implementer", "Validator", "Integration reviewer"],
    changeState: "candidate",
  },
];

export const conversationBranches: readonly ConversationBranchFixture[] = [
  {
    id: "project-main",
    scopeId: "project",
    label: "Primary Frame",
    pathLabel: "Project · MaxReps / Primary Frame",
    depth: 0,
  },
  {
    id: "session-main",
    scopeId: "waypoint:session-storage",
    label: "Waypoint conversation",
    pathLabel: "Waypoint · Session storage / Main",
    depth: 0,
  },
  {
    id: "session-refresh",
    scopeId: "waypoint:session-storage",
    label: "Resume after refresh",
    pathLabel: "Waypoint · Session storage / Resume after refresh",
    depth: 1,
  },
  {
    id: "session-suspension",
    scopeId: "waypoint:session-storage",
    label: "Suspension edge cases",
    pathLabel: "Waypoint · Session storage / Resume after refresh / Suspension edge cases",
    depth: 2,
  },
  {
    id: "timer-main",
    scopeId: "waypoint:timer-engine",
    label: "Waypoint conversation",
    pathLabel: "Waypoint · Timer engine / Main",
    depth: 0,
  },
  {
    id: "browser-main",
    scopeId: "waypoint:browser-suspension",
    label: "Waypoint conversation",
    pathLabel: "Waypoint · Suspension proof / Main",
    depth: 0,
  },
  {
    id: "evidence-main",
    scopeId: "waypoint:resume-evidence",
    label: "Waypoint conversation",
    pathLabel: "Waypoint · Resume evidence / Main",
    depth: 0,
  },
];

export const contextItems: readonly ContextItemFixture[] = [
  {
    id: "scope-objective",
    label: "Current Frame objective",
    detail: "A durable rest timer that resumes without hiding broken recovery paths.",
    source: "scope",
    defaultIncluded: true,
  },
  {
    id: "accepted-decisions",
    label: "3 accepted decisions",
    detail: "Wall time is authoritative; refresh and suspension remain separate proofs.",
    source: "decision",
    defaultIncluded: true,
  },
  {
    id: "recovery-memory",
    label: "Rest-session recovery contract",
    detail: "Accepted Memory · verified against revision 625137c.",
    source: "memory",
    defaultIncluded: true,
  },
  {
    id: "current-branch",
    label: "Current branch chain",
    detail: "Only messages that lead to the selected branch.",
    source: "branch",
    defaultIncluded: true,
  },
  {
    id: "stale-notes",
    label: "Stale timer notes",
    detail: "Older notes that predate the wall-time decision.",
    source: "memory",
    defaultIncluded: false,
  },
  {
    id: "whole-repository",
    label: "Whole repository",
    detail: "Excluded because no source expansion was requested.",
    source: "source",
    defaultIncluded: false,
  },
];

export const memories: readonly MemoryFixture[] = [
  {
    id: "recovery-contract",
    title: "Rest-session recovery contract",
    summary: "Refresh and suspension are separate proof cases; failure never degrades to clean.",
    status: "accepted",
    provenance: "Accepted Frame revision 625137c · verified 22 Aug",
  },
  {
    id: "timer-notes",
    title: "Timer reducer assumptions",
    summary: "Earlier elapsed-time notes conflict with the accepted wall-time decision.",
    status: "stale",
    provenance: "Research branch · superseded by revision 625137c",
  },
  {
    id: "offline-proposal",
    title: "Offline clock drift heuristic",
    summary: "A non-blocking proposal awaiting review in the Memory library.",
    status: "proposal",
    provenance: "Proposed from Conversation · not canonical",
  },
];

export const initialConversationMessages: readonly ConversationMessageFixture[] = [
  {
    id: "conversation-1",
    author: "You",
    time: "18:42",
    body: "The product must restore a rest timer after refresh without hiding suspension failures.",
    kind: "user",
    branchId: "project-main",
  },
  {
    id: "conversation-2",
    author: "Frame guide",
    time: "18:43",
    body: "I understand the end-state as one durable timer with two separately visible recovery proofs: refresh and browser suspension.",
    kind: "agent",
    branchId: "project-main",
  },
];
