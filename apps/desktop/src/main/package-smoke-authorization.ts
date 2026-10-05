import { lstatSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import {
  type ProjectStoragePackageSmokeScenario,
  parseProjectStoragePackageSmokeScenario,
} from "./project-storage-package-smoke.js";

const packageSmokeMarkerFilename = ".slopstop-package-smoke.json";
const packageSmokeTokenPattern = /^[0-9a-f]{64}$/u;
export const packageSmokeAuthorizationFailureMessage = "Package smoke authorization failed.";

export class PackageSmokeAuthorizationError extends Error {
  override readonly name = "PackageSmokeAuthorizationError";

  constructor() {
    super(packageSmokeAuthorizationFailureMessage);
  }
}

export type PackageSmokeAuthorization = Readonly<{
  root: string;
  scenario: ProjectStoragePackageSmokeScenario;
}>;

type ValidatedPackageSmokeInput = PackageSmokeAuthorization &
  Readonly<{
    token: string;
  }>;

function failAuthorization(): never {
  throw new PackageSmokeAuthorizationError();
}

function validateAuthorizationInput(
  input: Readonly<{
    root: string | undefined;
    token: string | undefined;
    scenario: string | undefined;
  }>,
): ValidatedPackageSmokeInput {
  const scenario = parseProjectStoragePackageSmokeScenario(input.scenario);
  if (input.root === undefined) {
    return failAuthorization();
  }
  if (!path.isAbsolute(input.root)) {
    return failAuthorization();
  }
  if (input.token === undefined) {
    return failAuthorization();
  }
  if (!packageSmokeTokenPattern.test(input.token)) {
    return failAuthorization();
  }
  return { root: input.root, token: input.token, scenario };
}

function markerPathInside(root: string): string {
  const markerPath = path.resolve(root, packageSmokeMarkerFilename);
  const markerRelative = path.relative(root, markerPath);
  if (markerRelative === "") {
    return failAuthorization();
  }
  if (markerRelative === "..") {
    return failAuthorization();
  }
  if (markerRelative.startsWith(`..${path.sep}`)) {
    return failAuthorization();
  }
  if (path.isAbsolute(markerRelative)) {
    return failAuthorization();
  }
  return markerPath;
}

function validateBootstrapRoot(root: string, scenario: ProjectStoragePackageSmokeScenario): void {
  if (scenario !== "bootstrap") {
    return;
  }
  const entries = readdirSync(root);
  if (entries.length !== 1) {
    failAuthorization();
  }
  if (entries[0] !== packageSmokeMarkerFilename) {
    failAuthorization();
  }
}

/** The registration proof's repository: the only entry beside the marker, a plain directory. */
export const packageSmokeRepositoryDirectory = "repository";

function validateRegistrationRoot(
  root: string,
  scenario: ProjectStoragePackageSmokeScenario,
): void {
  if (scenario !== "registration") {
    return;
  }
  const entries = readdirSync(root).sort();
  if (!isDeepStrictEqual(entries, [packageSmokeMarkerFilename, packageSmokeRepositoryDirectory])) {
    failAuthorization();
  }
  const repository = lstatSync(path.join(root, packageSmokeRepositoryDirectory));
  if (!repository.isDirectory() || repository.isSymbolicLink()) {
    failAuthorization();
  }
}

function validateAuthorizedRoot(input: ValidatedPackageSmokeInput): void {
  const rootEntry = lstatSync(input.root);
  if (!rootEntry.isDirectory()) {
    failAuthorization();
  }
  if (rootEntry.isSymbolicLink()) {
    failAuthorization();
  }

  const markerPath = markerPathInside(input.root);
  const markerEntry = lstatSync(markerPath);
  if (!markerEntry.isFile()) {
    failAuthorization();
  }
  if (markerEntry.isSymbolicLink()) {
    failAuthorization();
  }
  const marker: unknown = JSON.parse(readFileSync(markerPath, "utf8"));
  if (!isDeepStrictEqual(marker, { version: 1, token: input.token })) {
    failAuthorization();
  }
  validateBootstrapRoot(input.root, input.scenario);
  validateRegistrationRoot(input.root, input.scenario);
}

export function applyPackageSmokeAuthorization(
  input: Readonly<{
    root: string | undefined;
    token: string | undefined;
    scenario: string | undefined;
  }>,
  setUserDataRoot: (root: string) => void,
): PackageSmokeAuthorization {
  try {
    const authorization = validateAuthorizationInput(input);
    validateAuthorizedRoot(authorization);
    setUserDataRoot(authorization.root);
    return { root: authorization.root, scenario: authorization.scenario };
  } catch {
    throw new PackageSmokeAuthorizationError();
  }
}
