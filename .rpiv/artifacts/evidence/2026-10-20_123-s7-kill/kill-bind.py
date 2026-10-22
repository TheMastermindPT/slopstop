"""s7 survivor kills: each killed mutant re-applied as a binding, restored by sha256 and tree."""
import os
import subprocess
import sys

os.chdir("C:/Users/pedro/Documents/GitHub/slopstop-123")
K = ".rpiv/artifacts/evidence/2026-10-20_123-s7-kill"
M = "apps/desktop/src/main/"
runs = [
    ("m83", "harness-request-core", '    if (entry === undefined) return;\n    entries.delete(id);\n',
     '    if (false) return;\n    entries.delete(id);\n', "harness-request-core", "failure for an unknown id"),
    ("m117", "harness-session", "      if (failures.length > 1)\n", "      if (failures.length >= 1)\n",
     "harness-session", "delivers an event to every subscriber before propagating listener failures"),
    ("m157", "project-entry-bridge", '        "project.registration.result",\n', '        "",\n',
     "project-entry-bridge", "register"),
    ("m158", "project-entry-bridge", "        (value) => decodeReply(ProjectRegistrationResultSchema, value),\n",
     "        () => undefined,\n", "project-entry-bridge", "register"),
    ("m172", "project-entry-bridge", '      event: "project.activate.result",\n', '      event: "",\n',
     "project-entry-bridge", "activate"),
    ("m179", "project-entry-bridge", '      event: "project.switch.result",\n', '      event: "",\n',
     "project-entry-bridge", "switch"),
    ("m101", "workspace-bridge", 'const stoppedText = "Workspace bridge is stopped.";\n', 'const stoppedText = "";\n',
     "workspace-bridge", "answers the stopped text for a request made after stop"),
]
for name, source, old, new, test, row in runs:
    for ext, text in (("old", old), ("new", new)):
        open(f"{K}/bindings/{name}.{ext}", "w", encoding="utf8", newline="\n").write(text)
    r = subprocess.run([sys.executable, "-I", f"{K}/bind.py", f"{M}{source}.ts", f"{K}/bindings/{name}.old",
                        f"{K}/bindings/{name}.new", f"bind-{name}", "pnpm", "exec", "vitest", "run",
                        "--project", "desktop-main", f"{M}{test}.test.ts", "-t", row],
                       capture_output=True, text=True)
    tests = [l.strip() for l in open(f"{K}/bind-{name}.log", encoding="utf8") if "Tests  " in l]
    status = "MATCH" if r.stdout.count("MATCH") == 2 else "CHECK"
    print(name, tests, status, r.stderr.strip()[:200])
