import { lstat } from "node:fs/promises";
import path from "node:path";
import { Effect, Option } from "effect";

type DiscoveryEnvironment = Readonly<Record<string, string | undefined>>;

// Drive-absolute (C:\...) or UNC (\\server\share\...) only: a root-relative or
// drive-relative entry would resolve against the current directory.
function isAbsoluteEntry(entry: string): boolean {
  return /^(?:[A-Za-z]:[\\/]|[\\/]{2}[^\\/]+[\\/][^\\/]+)/.test(entry);
}

const isFile = (candidate: string) =>
  Effect.tryPromise(() => lstat(candidate)).pipe(
    Effect.map((entry) => entry.isFile()),
    Effect.orElseSucceed(() => false),
  );

/**
 * The Git executable PC-S1 offers: Git for Windows under Program Files, otherwise the first
 * absolute PATH entry of the harness's own environment that holds git.exe. The current
 * directory, relative and empty entries are never searched and no shell resolves the name.
 * The user still confirms the exact path, and its identity is pinned after that.
 */
export function discoverGitExecutable(
  environment: DiscoveryEnvironment,
): Effect.Effect<string | undefined> {
  const installed = path.win32.join(
    environment["ProgramFiles"] ?? "C:\\Program Files",
    "Git",
    "cmd",
    "git.exe",
  );
  const onPath = (environment["PATH"] ?? environment["Path"] ?? "")
    .split(";")
    .filter(isAbsoluteEntry)
    .map((entry) => path.win32.join(entry, "git.exe"));
  return Effect.findFirst([installed, ...onPath], isFile).pipe(Effect.map(Option.getOrUndefined));
}
