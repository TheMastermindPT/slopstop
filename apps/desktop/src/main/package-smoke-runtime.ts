import { createHash, randomBytes } from "node:crypto";
import type { Stats } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";

const challengeName = ".slopstop-runtime-challenge.json";
const witnessName = ".slopstop-runtime-witness.json";
const hex = /^[0-9a-f]{64}$/u;
const targets = new Set(["win32-x64", "linux-x64", "linux-arm64", "darwin-x64", "darwin-arm64"]);
type Image = Readonly<{ path: string; sha256: string }>;
type EvidenceFile = Readonly<{ path: string; limit: 256 | 512 }>;
type RuntimeWitness = Readonly<{
  version: 1;
  nonce: string;
  mainPid: number;
  platform: string;
  arch: string;
  electronVersion: string;
  executableSha256: string;
}>;
type LaunchBinding = Readonly<{
  root: string;
  nonce: string;
  image: Image;
  platform: string;
  arch: string;
}>;

function requireRuntime(condition: unknown): asserts condition {
  if (!condition) throw new Error("Package smoke runtime identity failed.");
}
function sameFile(first: Stats, second: Stats) {
  return first.dev === second.dev && first.ino === second.ino && first.size === second.size;
}
async function inspect(file: string, directory = false) {
  const stat = await lstat(file);
  requireRuntime(!stat.isSymbolicLink());
  requireRuntime(directory ? stat.isDirectory() : stat.isFile());
  requireRuntime((await realpath(file)) === file);
  return stat;
}
async function canonicalRoot(root: string) {
  requireRuntime(path.isAbsolute(root));
  const canonical = path.resolve(root);
  await inspect(canonical, true);
  return canonical;
}
async function requireAbsent(file: string) {
  try {
    await lstat(file);
  } catch (error) {
    if (isMissing(error)) return;
    throw error;
  }
  requireRuntime(false);
}
function isMissing(error: unknown) {
  if (typeof error !== "object" || error === null) return false;
  return Reflect.get(error, "code") === "ENOENT";
}
async function readBounded(file: EvidenceFile) {
  const stat = await inspect(file.path);
  const handle = await open(file.path, "r");
  try {
    requireRuntime(sameFile(stat, await handle.stat()));
    const bytes = Buffer.alloc(file.limit + 1);
    let total = 0;
    while (total < bytes.length) {
      const result = await handle.read(bytes, total, bytes.length - total, total);
      if (result.bytesRead === 0) break;
      total += result.bytesRead;
    }
    requireRuntime(total <= file.limit);
    requireRuntime(sameFile(stat, await inspect(file.path)));
    return bytes.subarray(0, total);
  } finally {
    await handle.close();
  }
}
function exactRecord(bytes: Uint8Array, fields: readonly string[]): Record<string, unknown> {
  const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  const value: unknown = JSON.parse(text);
  requireRuntime(typeof value === "object" && value !== null && !Array.isArray(value));
  requireRuntime(Object.keys(value).length === fields.length);
  requireRuntime(Object.keys(value).every((key) => fields.includes(key)));
  const keys = [...text.matchAll(/("(?:[^"\\]|\\.)*")\s*:/gu)].map((match) => {
    requireRuntime(match[1]);
    return JSON.parse(match[1]);
  });
  requireRuntime(keys.length === fields.length && new Set(keys).size === keys.length);
  return Object.fromEntries(Object.entries(value));
}
function challenge(bytes: Uint8Array) {
  const value = exactRecord(bytes, ["version", "nonce"]);
  requireRuntime(value["version"] === 1 && typeof value["nonce"] === "string");
  requireRuntime(hex.test(value["nonce"]));
  return value["nonce"];
}
function witness(bytes: Uint8Array): RuntimeWitness {
  const value = exactRecord(bytes, [
    "version",
    "nonce",
    "mainPid",
    "platform",
    "arch",
    "electronVersion",
    "executableSha256",
  ]);
  requireRuntime(value["version"] === 1);
  const nonce = value["nonce"],
    mainPid = value["mainPid"],
    platform = value["platform"],
    arch = value["arch"];
  const electronVersion = value["electronVersion"],
    executableSha256 = value["executableSha256"];
  requireRuntime(typeof nonce === "string" && hex.test(nonce));
  requireRuntime(typeof mainPid === "number" && Number.isSafeInteger(mainPid) && mainPid > 0);
  requireRuntime(typeof platform === "string" && typeof arch === "string");
  requireRuntime(targets.has(`${platform}-${arch}`) && electronVersion === "43.4.0");
  requireRuntime(typeof executableSha256 === "string" && hex.test(executableSha256));
  return { version: 1, nonce, mainPid, platform, arch, electronVersion, executableSha256 };
}
async function writeExclusive(file: EvidenceFile, value: object) {
  const text = JSON.stringify(value);
  requireRuntime(Buffer.byteLength(text) <= file.limit);
  const handle = await open(file.path, "wx", 0o600);
  try {
    const stat = await handle.stat();
    requireRuntime(stat.isFile() && !stat.isSymbolicLink());
    await handle.writeFile(text, "utf8");
  } finally {
    await handle.close();
  }
  await inspect(file.path);
}
async function executableImage(file: string): Promise<Image> {
  requireRuntime(path.isAbsolute(file) && path.normalize(file) === file);
  const stat = await inspect(file);
  const handle = await open(file, "r");
  const hash = createHash("sha256");
  try {
    requireRuntime(sameFile(stat, await handle.stat()));
    const bytes = Buffer.alloc(65536);
    let position = 0;
    for (;;) {
      const result = await handle.read(bytes, 0, bytes.length, position);
      if (result.bytesRead === 0) break;
      hash.update(bytes.subarray(0, result.bytesRead));
      position += result.bytesRead;
    }
    requireRuntime(position === stat.size && sameFile(stat, await inspect(file)));
  } finally {
    await handle.close();
  }
  return Object.freeze({ path: file, sha256: hash.digest("hex") });
}

export async function createRuntimeChallenge(
  input: Readonly<{ root: string; executable: string }>,
): Promise<LaunchBinding> {
  const canonical = await canonicalRoot(input.root);
  const image = await executableImage(input.executable);
  await requireAbsent(path.join(canonical, witnessName));
  const nonce = randomBytes(32).toString("hex");
  await writeExclusive(
    { path: path.join(canonical, challengeName), limit: 256 },
    { version: 1, nonce },
  );
  return Object.freeze({
    root: canonical,
    nonce,
    image,
    platform: process.platform,
    arch: process.arch,
  });
}

export async function prepareMainRuntimeWitness(
  input: Readonly<{ root: string }>,
): Promise<() => Promise<void>> {
  const canonical = await canonicalRoot(input.root);
  const nonce = challenge(
    await readBounded({ path: path.join(canonical, challengeName), limit: 256 }),
  );
  await requireAbsent(path.join(canonical, witnessName));
  const image = await executableImage(process.execPath);
  const observed = witness(
    Buffer.from(
      JSON.stringify({
        version: 1,
        nonce,
        mainPid: process.pid,
        platform: process.platform,
        arch: process.arch,
        electronVersion: process.versions["electron"],
        executableSha256: image.sha256,
      }),
    ),
  );
  return async () => {
    await canonicalRoot(canonical);
    await writeExclusive({ path: path.join(canonical, witnessName), limit: 512 }, observed);
  };
}

export async function verifyRuntimeWitness(
  binding: LaunchBinding,
  spawnedPid: unknown,
): Promise<RuntimeWitness> {
  await canonicalRoot(binding.root);
  const after = await executableImage(binding.image.path);
  requireRuntime(after.sha256 === binding.image.sha256);
  const observed = witness(
    await readBounded({ path: path.join(binding.root, witnessName), limit: 512 }),
  );
  requireRuntime(observed.nonce === binding.nonce && observed.mainPid === spawnedPid);
  requireRuntime(observed.platform === binding.platform && observed.arch === binding.arch);
  requireRuntime(observed.executableSha256 === after.sha256);
  return observed;
}
