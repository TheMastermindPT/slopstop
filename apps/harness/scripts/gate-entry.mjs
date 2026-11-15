/**
 * Tells a gate script whether it is the process entry, by file identity. Accepted corner cases:
 *
 * - `runGateEntry` returns what `run()` returns and does not await it: an asynchronous script
 *   awaits `runGateEntry` itself.
 * - A script that imports this helper must be copied together with it.
 * - A read error without a `code` answers `cannot read <path>: undefined`; a module URL that is not
 *   a `file:` URL throws instead of answering unknown.
 * - `node -e <code> <gate script>` answers `"entry"`: the first user argument is `process.argv[1]`.
 * - A Worker whose file is the gate script answers `"entry"`.
 * - Hard links to one script share its identity, so each counts as the entry.
 * - An overlayfs copy-up without `xino` can change a file's identity between two reads; cloned
 *   volumes can share one serial, so only the file index tells their files apart.
 * - ReFS's all-ones file index is taken from its documentation, not observed; remote SMB shares,
 *   mapped drives, exFAT and macOS were not observed.
 */
import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** `ino` values that name no file: a filesystem without 64-bit IDs gives 0, ReFS gives all ones. */
const noFileIndex = new Set([0n, 0xffffffffffffffffn, -1n]);

/**
 * The identity of the file at `path` as `dev:ino` (read as bigint, so Windows file indexes keep
 * their precision), or the reason it cannot be read or names no file. On Windows `dev` is the
 * volume serial and 0 means there is none (`\\wsl.localhost` gives 0 for every file); elsewhere
 * `dev` 0 is an ordinary device number.
 */
function fileIdentity(path, stat, platform) {
  let metadata;
  try {
    metadata = stat(path, { bigint: true });
  } catch (error) {
    return { unknown: `cannot read ${path}: ${error.code}` };
  }
  if (noFileIndex.has(metadata.ino)) {
    return { unknown: `no file identity for ${path}: ino ${metadata.ino}` };
  }
  if (platform === "win32" && metadata.dev === 0n) {
    return { unknown: `no volume identity for ${path}: dev 0` };
  }
  return { identity: `${metadata.dev}:${metadata.ino}`, directory: metadata.isDirectory() };
}

/**
 * Whether the gate script at `moduleUrl` is the process entry. It compares file identity, not path
 * spelling, so a launch through a linked folder, another drive spelling or a short name still
 * counts. Answers `"entry"`, `"imported"` (the entry is another file, or there is no entry path
 * and the module's own file has a usable identity) or `{ unknown: reason }` when a file it reads
 * cannot be read or has no usable identity, or the entry path is a directory (`node <dir>` leaves
 * the folder, not the file Node loaded, as the entry). With no entry path only the module's own
 * file is read, so a gate whose source is fed to Node on stdin or through `-e` fails visibly.
 */
export function gateEntry(moduleUrl, ports = {}) {
  const entry = "entry" in ports ? ports.entry : process.argv[1];
  const stat = ports.stat ?? statSync;
  const platform = ports.platform ?? process.platform;
  const ownIdentity = () => fileIdentity(fileURLToPath(moduleUrl), stat, platform);
  if (entry === undefined) {
    const own = ownIdentity();
    return own.unknown ? { unknown: own.unknown } : "imported";
  }
  const launched = fileIdentity(entry, stat, platform);
  if (launched.unknown) return { unknown: launched.unknown };
  if (launched.directory) return { unknown: `entry path is a directory: ${entry}` };
  const own = ownIdentity();
  if (own.unknown) return { unknown: own.unknown };
  return launched.identity === own.identity ? "entry" : "imported";
}

/**
 * Runs a gate script's entry block: `run()` when the script is the process entry, nothing when it
 * is imported, and a visible failure (`GATE_ENTRY_UNKNOWN` on stderr, exit code 1) when it cannot
 * tell. It never exits 0 without checking.
 */
export function runGateEntry(moduleUrl, run, ports = {}) {
  const answer = gateEntry(moduleUrl, ports);
  if (answer === "entry") return run();
  if (answer === "imported") return undefined;
  const stderr = ports.stderr ?? process.stderr;
  const setExitCode =
    ports.setExitCode ??
    ((code) => {
      process.exitCode = code;
    });
  stderr.write(`GATE_ENTRY_UNKNOWN: ${answer.unknown}\n`);
  setExitCode(1);
  return undefined;
}
