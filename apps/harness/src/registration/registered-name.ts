/**
 * The Project's default name: the last folder of the worktree recorded when it was proposed.
 * Git reports worktree paths with either separator on Windows.
 */
export function registeredName(worktree: string): string {
  const name = worktree
    .split(/[\\/]/)
    .filter((segment) => segment.length > 0)
    .pop();
  if (name === undefined) throw new Error("Registered worktree has no folder name.");
  return name;
}
