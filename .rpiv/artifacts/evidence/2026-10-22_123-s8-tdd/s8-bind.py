"""s8 bindings: each mutation re-applied in harness-supervisor.ts, its rows run, restored by sha256 and tree."""
import os
import subprocess
import sys

os.chdir("C:/Users/pedro/Documents/GitHub/slopstop-123")
E = ".rpiv/artifacts/evidence/2026-10-22_123-s8-tdd"
SRC = "apps/desktop/src/main/harness-supervisor.ts"
TEST = "apps/desktop/src/main/harness-supervisor.test.ts"
drain = "      Effect.andThen(drainOutput(observation)),\n"
settle = ("      Effect.andThen(\n        Effect.sync(() => {\n"
          "          this.#setStatus({ state: \"stopped\" });\n          this.#stopping = false;\n"
          "        }),\n      ),\n")
runs = [
    ("b1-skip-drain", drain, "", "waits after exit until stdout"),
    ("b2-bound-999", "const harnessStdoutDrainMs = 1_000;\n", "const harnessStdoutDrainMs = 999;\n",
     "resolves the stop at the drain bound"),
    ("b2-bound-1001", "const harnessStdoutDrainMs = 1_000;\n", "const harnessStdoutDrainMs = 1_001;\n",
     "resolves the stop at the drain bound"),
    ("b2-no-forwarder-removal", "      orElse: () => Effect.sync(observation.endForwarding),\n",
     "      orElse: () => Effect.void,\n", "resolves the stop at the drain bound"),
    ("b1-stopped-at-exit", drain + settle, settle + drain, "waits after exit until stdout"),
]
for name, old, new, row in runs:
    for ext, text in (("old", old), ("new", new)):
        open(f"{E}/bindings/{name}.{ext}", "w", encoding="utf8", newline="\n").write(text)
    r = subprocess.run([sys.executable, "-I", f"{E}/bind.py", SRC, f"{E}/bindings/{name}.old",
                        f"{E}/bindings/{name}.new", f"bind-{name}", "pnpm", "exec", "vitest", "run",
                        "--project", "desktop-main", TEST, "-t", row], capture_output=True, text=True)
    log = open(f"{E}/bind-{name}.log", encoding="utf8").read()
    tests = [l.strip() for l in log.splitlines() if "Tests  " in l]
    fails = [l.strip()[:90] for l in log.splitlines() if l.strip().startswith("×")]
    print(name, tests, fails, "MATCH" if r.stdout.count("MATCH") == 2 else "CHECK " + r.stdout[-200:] + r.stderr[-200:])
