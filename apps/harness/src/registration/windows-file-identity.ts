import { createHash } from "node:crypto";
import { acceptsStrict, decodeStrict, decodeStrictResult } from "@slopstop/protocol";
import { Result, Schema } from "effect";
import * as koffi from "koffi";
import {
  type ExecutableIdentityObservation,
  ExecutableIdentitySchema,
} from "./executable-identity.js";
import {
  PhysicalDirectoryKeySchema,
  PhysicalIdentitySchema,
  type RepositoryDirectoryObservation,
} from "./physical-identity.js";
import {
  createWindowsObserverApi,
  nativeInteger,
  readWindowsBuffer,
  requireWindowsSuccess,
  WindowsObserverApiError,
  WindowsObserverResources,
} from "./windows-observer-api.js";

const LocalNtfsSchema = Schema.Struct({
  filesystem: Schema.Literal("NTFS"),
  deviceType: Schema.Literal(7),
  remote: Schema.Literal(false),
});

function createFileApi() {
  const library = koffi.load("kernel32.dll");
  const nt = koffi.load("ntdll.dll");
  const information: (handle: bigint, kind: number, buffer: Buffer, size: number) => unknown =
    library.func(
      "int __stdcall GetFileInformationByHandleEx(void *handle, int kind, void *buffer, uint32_t size)",
    );
  const volume: (...args: readonly unknown[]) => unknown = library.func(
    "int __stdcall GetVolumeInformationByHandleW(void *handle, void *name, uint32_t nameSize, void *serial, void *maxComponent, void *flags, void *fsName, uint32_t fsNameSize)",
  );
  const device: (...args: readonly unknown[]) => unknown = nt.func(
    "int32_t __stdcall NtQueryVolumeInformationFile(void *handle, void *io, void *info, uint32_t length, int kind)",
  );
  return { information, volume, device };
}

function localNtfs(api: ReturnType<typeof createFileApi>, handle: bigint): boolean {
  const name = Buffer.alloc(512);
  if (nativeInteger(api.volume(handle, null, 0, null, null, null, name, 256)) === 0) {
    throw new Error("Windows volume observation failed.");
  }
  const io = Buffer.alloc(16);
  const device = Buffer.alloc(8);
  const status = nativeInteger(api.device(handle, io, device, 8, 4));
  if (status < 0) throw new Error("Windows volume device observation failed.");
  return acceptsStrict(LocalNtfsSchema, {
    filesystem: name.toString("utf16le").split("\0")[0],
    deviceType: device.readUInt32LE(0),
    remote: (device.readUInt32LE(4) & 0x10) !== 0,
  });
}

function identityMetadata(
  resources: WindowsObserverResources,
  api: ReturnType<typeof createFileApi>,
  handle: bigint,
) {
  const identity = Buffer.alloc(24);
  const basic = Buffer.alloc(40);
  requireWindowsSuccess(resources.api, api.information(handle, 18, identity, identity.length));
  requireWindowsSuccess(resources.api, api.information(handle, 0, basic, basic.length));
  return { identity, basic };
}

function nativeIdentity(identity: Buffer, basic: Buffer) {
  const fileIdentity = identity.readBigUInt64LE(8) | (identity.readBigUInt64LE(16) << 64n);
  const birthIdentity = (basic.readBigInt64LE(0) - 116444736000000000n) * 100n;
  return decodeStrictResult(PhysicalIdentitySchema, {
    platform: "win32",
    volumeIdentity: String(identity.readBigUInt64LE(0)),
    fileIdentity: String(fileIdentity),
    birthIdentity: String(birthIdentity),
  });
}

function directoryObservationFailure(error: unknown): RepositoryDirectoryObservation {
  if (error instanceof WindowsObserverApiError) {
    if (error.code === 5) return { status: "unavailable", code: "REPOSITORY_INACCESSIBLE" };
    if ([2, 3].includes(error.code)) return { status: "rejected", code: "REPOSITORY_NOT_FOUND" };
  }
  return { status: "broken", code: "INTERNAL_FAILURE" };
}

export async function observeWindowsDirectory(
  location: string,
): Promise<RepositoryDirectoryObservation> {
  const kernel = createWindowsObserverApi();
  const resources = new WindowsObserverResources(kernel);
  try {
    const handle = resources.ownHandle(
      kernel.createFile(location, 0x80, 7, null, 3, 0x02000000, null),
    );
    const api = createFileApi();
    if (!localNtfs(api, handle)) {
      return { status: "unavailable", code: "IDENTITY_CAPABILITY_UNAVAILABLE" };
    }
    const { identity, basic } = identityMetadata(resources, api, handle);
    if ((basic.readUInt32LE(32) & 0x10) === 0) {
      return { status: "rejected", code: "OBSERVATION_INVALID" };
    }
    const parsed = nativeIdentity(identity, basic);
    if (Result.isFailure(parsed)) {
      return { status: "unavailable", code: "IDENTITY_CAPABILITY_UNAVAILABLE" };
    }
    return {
      status: "observed",
      key: decodeStrict(PhysicalDirectoryKeySchema, {
        ...parsed.success,
        version: "physical-directory/v1",
      }),
    };
  } catch (error) {
    return directoryObservationFailure(error);
  } finally {
    resources.close();
  }
}

function executableDigest(
  resources: WindowsObserverResources,
  handle: bigint,
  size: bigint,
): string {
  if (size < 0n) throw new Error("Invalid executable length.");
  const digest = createHash("sha256");
  let remaining = size;
  while (remaining > 0n) {
    const length = Number(remaining < 65536n ? remaining : 65536n);
    const buffer = readWindowsBuffer(resources.api, handle, length);
    if (buffer.byteLength === 0) throw new Error("Executable changed during digest observation.");
    digest.update(buffer);
    remaining -= BigInt(buffer.byteLength);
  }
  return digest.digest("hex");
}

function sameReadSnapshot(
  before: Buffer,
  after: Buffer,
  oldSize: Buffer,
  newSize: Buffer,
): boolean {
  return (
    before.subarray(0, 8).equals(after.subarray(0, 8)) &&
    before.subarray(16, 24).equals(after.subarray(16, 24)) &&
    oldSize.readBigInt64LE(8) === newSize.readBigInt64LE(8)
  );
}

export async function observeWindowsExecutable(
  location: string,
): Promise<ExecutableIdentityObservation> {
  const kernel = createWindowsObserverApi();
  const resources = new WindowsObserverResources(kernel);
  try {
    const handle = resources.ownHandle(
      kernel.createFile(location, 0x80000000, 7, null, 3, 0, null),
    );
    const api = createFileApi();
    if (!localNtfs(api, handle)) {
      return { status: "unavailable", code: "IDENTITY_CAPABILITY_UNAVAILABLE" };
    }
    const { identity, basic } = identityMetadata(resources, api, handle);
    const standard = Buffer.alloc(24);
    requireWindowsSuccess(kernel, api.information(handle, 1, standard, standard.length));
    const parsed = nativeIdentity(identity, basic);
    if (Result.isFailure(parsed)) {
      return { status: "unavailable", code: "IDENTITY_CAPABILITY_UNAVAILABLE" };
    }
    const sha256 = executableDigest(resources, handle, standard.readBigInt64LE(8));
    const afterBasic = Buffer.alloc(40);
    const afterStandard = Buffer.alloc(24);
    requireWindowsSuccess(kernel, api.information(handle, 0, afterBasic, afterBasic.length));
    requireWindowsSuccess(kernel, api.information(handle, 1, afterStandard, afterStandard.length));
    if (!sameReadSnapshot(basic, afterBasic, standard, afterStandard)) {
      throw new Error("Executable changed during identity observation.");
    }
    return {
      status: "observed",
      identity: decodeStrict(ExecutableIdentitySchema, { ...parsed.success, sha256 }),
    };
  } catch {
    return { status: "broken", code: "INTERNAL_FAILURE" };
  } finally {
    resources.close();
  }
}
