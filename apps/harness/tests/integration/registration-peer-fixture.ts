import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const peerMessageSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("ready") }),
  z.strictObject({ kind: z.literal("migration") }),
  z.strictObject({ kind: z.literal("locked") }),
  z.strictObject({ kind: z.literal("result"), outcome: z.unknown() }),
  z.strictObject({ kind: z.literal("failed"), message: z.string() }),
]);
type PeerMessage = z.infer<typeof peerMessageSchema>;
type PeerRequest =
  | { kind: "prepare"; selectionId: string; executablePath: string }
  | { kind: "release" | "stop" };

export async function startRegistryPeer(root: string, migrations: string, hold = false) {
  const child = spawn(
    process.execPath,
    [
      "--experimental-transform-types",
      fileURLToPath(new URL("./registration-registry-peer.mjs", import.meta.url)),
      root,
      migrations,
      hold ? "hold" : "free",
    ],
    { stdio: ["ignore", "pipe", "pipe", "ipc"], windowsHide: true },
  );
  const messages: PeerMessage[] = [];
  const waiting = new Set<() => void>();
  let stderr = "";
  let ended = false;
  if (child.stderr === null) throw new Error("Registry peer diagnostic pipe is missing.");
  child.stderr.on("data", (data: Buffer) => {
    stderr += data.toString();
  });
  child.on("message", (message) => {
    messages.push(peerMessageSchema.parse(message));
    for (const notify of waiting) notify();
  });
  const exit = new Promise<void>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => {
      ended = true;
      for (const notify of waiting) notify();
      if (code === 0) resolve();
      else reject(new Error(`Registry peer exit ${code}: ${stderr}`));
    });
  });
  void exit.catch(() => undefined);
  let cursor = 0;
  const next = (kind: PeerMessage["kind"]): Promise<PeerMessage> =>
    new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        waiting.delete(check);
        reject(new Error(`Registry peer timed out: ${stderr}`));
      }, 10000);
      function check() {
        const index = messages.findIndex(
          (message, position) => position >= cursor && message.kind === kind,
        );
        const message = messages[index];
        if (message !== undefined) {
          cursor = index + 1;
          clearTimeout(timeout);
          waiting.delete(check);
          resolve(message);
        } else if (ended) {
          clearTimeout(timeout);
          waiting.delete(check);
          reject(new Error(`Registry peer ended: ${stderr}`));
        }
      }
      waiting.add(check);
      check();
    });
  await next("ready");
  return {
    messages,
    next,
    send: (message: PeerRequest) => child.send(message),
    stop: async () => {
      if (!ended) child.send({ kind: "stop" });
      const timeout = setTimeout(() => child.kill(), 10000);
      try {
        await exit;
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
