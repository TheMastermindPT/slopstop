"""Product-survivor bindings: each killed mutant re-applied in its source, its row run, restored."""
import os
import subprocess
import sys

os.chdir("C:/Users/pedro/Documents/GitHub/slopstop-123")
K = ".rpiv/artifacts/evidence/2026-10-22_123-product-kill"
NE = "apps/harness/src/storage/project-storage-node-errors.ts"
AD = "apps/harness/src/storage/project-storage-upgrade-node-adapter.ts"
NET = "apps/harness/src/storage/project-storage-node-errors.test.ts"
ADT = "apps/harness/src/storage/project-storage-upgrade-node-adapter.test.ts"
guard = '  if (typeof input.error !== "object" || input.error === null) return undefined;\n'
runs = [
    ("m7-condition-false", NE, guard, "  if (false) return undefined;\n", NET, "never from a function"),
    ("m7-left-false", NE, guard, "  if (false || input.error === null) return undefined;\n", NET, "never from a function"),
    ("m7-and", NE, guard, '  if (typeof input.error !== "object" && input.error === null) return undefined;\n',
     NET, "never from a function"),
    ("m57-condition-false", NE, "  if (input.error instanceof ProjectStorageUnavailableError) return true;\n",
     "  if (false) return true;\n", NET, "unavailable class"),
    ("m57-return-false", NE, "  if (input.error instanceof ProjectStorageUnavailableError) return true;\n",
     "  if (input.error instanceof ProjectStorageUnavailableError) return false;\n", NET, "unavailable class"),
    ("m61-not-error", NE, "  return error instanceof Error && isBusyStorageError({ error: error.cause });\n",
     "  return false && isBusyStorageError({ error: error.cause });\n", NET, "wrapped busy cause"),
    ("m63-empty-input", NE, "  return error instanceof Error && isBusyStorageError({ error: error.cause });\n",
     "  return error instanceof Error && isBusyStorageError({});\n", NET, "wrapped busy cause"),
    ("m560-no-cause", AD,
     "  if (isBusyStorageError({ error })) return new ProjectStorageUpgradeBusyError({ cause: error });\n",
     "  if (isBusyStorageError({ error })) return new ProjectStorageUpgradeBusyError({});\n", ADT, "raw busy"),
    ("m561-no-cause", AD, "  return new ProjectStorageBrokenError(\"Project Storage upgrade marker could not be read.\", {\n    cause: error,\n  });\n",
     "  return new ProjectStorageBrokenError(\"Project Storage upgrade marker could not be read.\", {});\n",
     ADT, "anything else is broken"),
]
for name, src, old, new, test, row in runs:
    for ext, text in (("old", old), ("new", new)):
        open(f"{K}/bindings/{name}.{ext}", "w", encoding="utf8", newline="\n").write(text)
    r = subprocess.run([sys.executable, "-I", f"{K}/bind.py", src, f"{K}/bindings/{name}.old",
                        f"{K}/bindings/{name}.new", f"bind-{name}", "pnpm", "exec", "vitest", "run",
                        "--project", "harness", test, "-t", row], capture_output=True, text=True)
    log = open(f"{K}/bind-{name}.log", encoding="utf8").read() if os.path.exists(f"{K}/bind-{name}.log") else ""
    tests = [l.strip() for l in log.splitlines() if "Tests  " in l]
    print(name, tests, "MATCH" if r.stdout.count("MATCH") == 2 else "CHECK " + (r.stdout + r.stderr)[-300:])
