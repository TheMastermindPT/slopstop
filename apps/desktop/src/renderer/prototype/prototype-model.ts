import {
  type ConversationBranchFixture,
  conversationBranches,
  type FileFixture,
  files,
  type RunFixture,
  runs,
  type WaypointFixture,
  waypoints,
} from "./prototype-fixtures.js";

export type Selection =
  | { kind: "project"; id: string }
  | { kind: "waypoint"; id: string }
  | { kind: "file"; id: string }
  | { kind: "run"; id: string }
  | { kind: "changes"; id: string };

export type RightTab = "details" | "evidence" | "changes";
export type MapMode = "topology" | "list";
export type SettingsScope = "application" | "project" | "models";
export type ContextRecordView = Readonly<{
  id: string;
  includedIds: readonly string[];
  excludedIds: readonly string[];
}>;

export function waypointById(id: string): WaypointFixture | undefined {
  return waypoints.find((waypoint) => waypoint.id === id);
}

export function fileById(id: string): FileFixture | undefined {
  return files.find((file) => file.id === id);
}

export function runById(id: string): RunFixture | undefined {
  return runs.find((run) => run.id === id);
}

export function conversationBranchById(id: string): ConversationBranchFixture {
  const branch = conversationBranches.find((candidate) => candidate.id === id);
  if (branch === undefined) {
    throw new Error(`Unknown prototype conversation branch: ${id}`);
  }
  return branch;
}

export function mainConversationBranch(scopeId: string): ConversationBranchFixture {
  const branch = conversationBranches.find(
    (candidate) => candidate.scopeId === scopeId && candidate.depth === 0,
  );
  if (branch === undefined) {
    throw new Error(`Unknown prototype conversation scope: ${scopeId}`);
  }
  return branch;
}
