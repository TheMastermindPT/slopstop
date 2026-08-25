import { spawn } from "node:child_process";
import path from "node:path";

const smokeTimeoutMs = 15_000;

function packagedExecutable() {
  const outputName = `SlopStop-${process.platform}-${process.arch}`;
  const outputDirectory = path.resolve("out", outputName);

  if (process.platform === "win32") {
    return path.join(outputDirectory, "SlopStop.exe");
  }

  if (process.platform === "darwin") {
    return path.join(outputDirectory, "SlopStop.app", "Contents", "MacOS", "SlopStop");
  }

  return path.join(outputDirectory, "SlopStop");
}

await new Promise((resolve, reject) => {
  const child = spawn(packagedExecutable(), [], {
    env: {
      ...process.env,
      SLOPSTOP_PACKAGE_SMOKE: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const errorChunks = [];
  const timeout = setTimeout(() => {
    child.kill();
    reject(
      new Error(
        `Packaged SlopStop did not validate the renderer boundary within ${smokeTimeoutMs}ms.`,
      ),
    );
  }, smokeTimeoutMs);

  child.stderr.on("data", (chunk) => {
    errorChunks.push(chunk);
  });
  child.once("error", (error) => {
    clearTimeout(timeout);
    reject(error);
  });
  child.once("exit", (code) => {
    clearTimeout(timeout);
    if (code === 0) {
      process.stdout.write(
        "Packaged SlopStop validated the renderer boundary and exited cleanly.\n",
      );
      resolve();
      return;
    }

    const errorOutput = Buffer.concat(errorChunks).toString("utf8").slice(-4_000);
    reject(new Error(`Packaged SlopStop exited with code ${String(code)}.\n${errorOutput}`));
  });
});
