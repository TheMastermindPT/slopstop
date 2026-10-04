import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { registrationSession } from "./registration-flow-fixture.js";
import { installedGit } from "./registration-git-fixture.js";

const startingDirectory = process.cwd();
afterEach(() => {
  process.chdir(startingDirectory);
  vi.unstubAllEnvs();
});

async function gitCopy(directory: string) {
  await mkdir(directory, { recursive: true });
  const executable = path.join(directory, "git.exe");
  await copyFile(installedGit, executable);
  return executable;
}

it.runIf(process.platform === "win32")(
  "offers Program Files Git first and otherwise the first absolute PATH entry holding git.exe",
  async () => {
    const session = await registrationSession();
    try {
      const programFiles = path.join(session.root, "program-files");
      const onPath = await gitCopy(path.join(session.root, "on-path"));
      vi.stubEnv("ProgramFiles", programFiles);
      vi.stubEnv("PATH", path.dirname(onPath));
      expect(await session.register({ step: "prepare-git" })).toMatchObject({
        status: "git-prepared",
        executablePath: onPath,
      });

      const installed = await gitCopy(path.join(programFiles, "Git", "cmd"));
      expect(await session.register({ step: "prepare-git" })).toMatchObject({
        status: "git-prepared",
        executablePath: installed,
      });
    } finally {
      await session.dispose();
    }
  },
);

it.runIf(process.platform === "win32")(
  "never takes git.exe from the current directory or a relative or empty PATH entry",
  async () => {
    const session = await registrationSession();
    try {
      const workingDirectory = path.join(session.root, "cwd");
      await gitCopy(workingDirectory);
      await gitCopy(path.join(workingDirectory, "relative"));
      process.chdir(workingDirectory);
      vi.stubEnv("ProgramFiles", path.join(session.root, "program-files"));
      vi.stubEnv("PATH", ["relative", ".", "", path.join(session.root, "empty")].join(";"));
      expect(await session.register({ step: "prepare-git" })).toEqual({
        status: "unavailable",
        code: "GIT_UNAVAILABLE",
      });

      const absolute = await gitCopy(path.join(session.root, "absolute"));
      vi.stubEnv("PATH", ["relative", ".", "", path.dirname(absolute)].join(";"));
      expect(await session.register({ step: "prepare-git" })).toMatchObject({
        status: "git-prepared",
        executablePath: absolute,
      });
    } finally {
      await session.dispose();
    }
  },
);
