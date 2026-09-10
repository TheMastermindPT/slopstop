import { expect, it, vi } from "vitest";
import * as leases from "./canonical-writer-lease.js";

function fixture(platform: NodeJS.Platform = "linux") {
  const close = vi.fn(async () => undefined);
  const dependencies = {
    platform,
    openLeaseFile: vi.fn(async () => ({ fd: 17, close })),
    tryLock: vi.fn((_fd: number, _offset: number, _length: number) => true),
    unlock: vi.fn((_fd: number, _offset: number, _length: number) => undefined),
  };
  const create = leases.createCanonicalWriterLeaseFactory;
  expect(create).toBeTypeOf("function");
  if (typeof create !== "function") throw new Error("Native lease factory is missing.");
  return { ...dependencies, close, factory: create(dependencies) };
}

it("classifies every injected native lease acquisition branch", async () => {
  for (const platform of ["linux", "win32"] as const) {
    const f = fixture(platform);
    f.tryLock.mockReturnValue(false);
    expect(await f.factory.acquire("lease")).toEqual({ status: "contended" });
    expect(f.close).toHaveBeenCalledOnce();
    expect(f.tryLock).toHaveBeenCalledExactlyOnceWith(17, 0, 1);
  }
  for (const [platform, failure, expected] of [
    ["win32", { code: "EBUSY" }, "contended"],
    ["linux", { code: "EBUSY" }, "broken"],
    ["linux", { code: "EACCES" }, "broken"],
    ["win32", new Error("lock failed"), "broken"],
  ] as const) {
    const f = fixture(platform);
    f.tryLock.mockImplementation(() => {
      throw failure;
    });
    const result = await f.factory.acquire("lease");
    if (expected === "contended") expect(result).toEqual({ status: "contended" });
    else
      expect(result).toMatchObject({
        status: "broken",
        error: { code: "WRITER_LEASE_LOCK_FAILED", cause: failure },
      });
    expect(f.close).toHaveBeenCalledOnce();
    expect(f.tryLock).toHaveBeenCalledExactlyOnceWith(17, 0, 1);
  }
  const failedOpen = fixture();
  failedOpen.openLeaseFile.mockRejectedValue(new Error("open failed"));
  expect(await failedOpen.factory.acquire("lease")).toMatchObject({
    status: "broken",
    error: { code: "WRITER_LEASE_OPEN_FAILED" },
  });
  expect(failedOpen.close).not.toHaveBeenCalled();
  await verifyUnacquiredCleanup(false);
  await verifyUnacquiredCleanup(true);
});

function expectCombinedCauses(cause: unknown, lockFailure: Error, closeFailure: Error): void {
  expect(cause).toBeInstanceOf(AggregateError);
  if (!(cause instanceof AggregateError)) throw new Error("Missing both causes.");
  expect(cause.errors).toEqual([expect.objectContaining({ cause: lockFailure }), closeFailure]);
}

async function verifyUnacquiredCleanup(lockFails: boolean): Promise<void> {
  const f = fixture();
  const lockFailure = new Error("lock failure");
  const closeFailure = new Error("close failure");
  f.tryLock.mockImplementation(() => {
    if (lockFails) throw lockFailure;
    return false;
  });
  f.close.mockRejectedValueOnce(closeFailure);
  const result = await f.factory.acquire("lease");
  expect(result).toMatchObject({ status: "broken", error: { code: "WRITER_LEASE_CLOSE_FAILED" } });
  if (result.status !== "broken" || result.cleanup === undefined)
    throw new Error("Cleanup ownership is missing.");
  if (lockFails) {
    expectCombinedCauses(result.error.cause, lockFailure, closeFailure);
  } else expect(result.error.cause).toBe(closeFailure);
  const retry = result.cleanup.close();
  expect(result.cleanup.close()).toBe(retry);
  await retry;
  await result.cleanup.close();
  expect(f.close).toHaveBeenCalledTimes(2);
  expect(f.unlock).not.toHaveBeenCalled();
}

it("resumes native lease release from the failed stage", async () => {
  for (const scenario of [
    {
      stage: "unlock",
      code: "WRITER_LEASE_UNLOCK_FAILED",
      unlockCount: 2,
      closeCount: 1,
      priorCloseCount: 0,
    },
    {
      stage: "close",
      code: "WRITER_LEASE_CLOSE_FAILED",
      unlockCount: 1,
      closeCount: 2,
      priorCloseCount: 1,
    },
    { stage: "none", code: null, unlockCount: 1, closeCount: 1, priorCloseCount: 1 },
  ]) {
    const f = fixture();
    if (scenario.stage === "unlock")
      f.unlock.mockImplementationOnce(() => {
        throw new Error("unlock failure");
      });
    if (scenario.stage === "close") f.close.mockRejectedValueOnce(new Error("close failure"));
    const result = await f.factory.acquire("lease");
    expect(result.status).toBe("acquired");
    if (result.status !== "acquired") throw new Error("Lease was not acquired.");
    const first = result.lease.release();
    expect(result.lease.release()).toBe(first);
    if (scenario.code === null) await first;
    else {
      await expect(first).rejects.toMatchObject({ code: scenario.code });
      expect(f.close).toHaveBeenCalledTimes(scenario.priorCloseCount);
      await result.lease.release();
    }
    await result.lease.release();
    expect(f.unlock).toHaveBeenCalledTimes(scenario.unlockCount);
    expect(f.close).toHaveBeenCalledTimes(scenario.closeCount);
    expect(f.unlock).toHaveBeenCalledWith(17, 0, 1);
  }
});
