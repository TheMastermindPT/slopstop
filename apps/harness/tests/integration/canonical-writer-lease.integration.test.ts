import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import * as leases from "../../src/storage/canonical-writer-lease.js";

const peerSource = `
const {open} = require('node:fs/promises');
const native = require(process.argv[2]);
void (async () => {
  const file = await open(process.argv[1], 'a+', 0o600);
  if (!native.tryLock(file.fd, 0, 1)) throw new Error('Peer lease denied.');
  process.once('message', () => {
    void (async () => {
      native.unlock(file.fd, 0, 1);
      await file.close();
      process.send('released', () => process.disconnect());
    })().catch(() => process.exit(1));
  });
  process.send('locked');
})().catch(() => process.exit(1));
`;

it("holds one native byte-range lease across independent descriptors", async () => {
  const create = leases.createNodeCanonicalWriterLeaseFactory;
  expect(create).toBeTypeOf("function");
  if (typeof create !== "function") throw new Error("Native lease factory is missing.");
  const root = await mkdtemp(path.join(os.tmpdir(), "slopstop-native-lease-"));
  const leasePath = path.join(root, ".slopstop-writer.lock");
  const nativeEntry = createRequire(import.meta.url).resolve("fs-native-extensions");
  const peer = spawn(process.execPath, ["-e", peerSource, leasePath, nativeEntry], {
    stdio: ["ignore", "ignore", "ignore", "ipc"],
  });
  const exited = once(peer, "exit");
  const earlyExit = exited.then(() => {
    throw new Error("Peer exited before its expected message.");
  });
  try {
    expect(await Promise.race([once(peer, "message"), earlyExit])).toEqual(["locked", undefined]);
    const factory = create();
    expect(await factory.acquire(leasePath)).toEqual({ status: "contended" });
    const released = once(peer, "message");
    peer.send("release");
    expect(await Promise.race([released, earlyExit])).toEqual(["released", undefined]);
    expect(await exited).toEqual([0, null]);
    const next = await factory.acquire(leasePath);
    expect(next.status).toBe("acquired");
    if (next.status !== "acquired") throw new Error("Lease takeover failed.");
    await next.lease.release();
  } finally {
    if (peer.exitCode === null && peer.signalCode === null) peer.kill();
    await exited;
    await rm(root, { recursive: true, force: true });
  }
});
