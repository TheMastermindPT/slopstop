"""s7 fix round: writes the 8 new binding snippets, copies the 10 first-build ones, then runs all 18
through bind.py, one after another, on the current tree."""
import os
import shutil
import subprocess
import sys

ROOT = "C:/Users/pedro/Documents/GitHub/slopstop-123"
E = ".rpiv/artifacts/evidence/2026-10-20_123-s7-fix"
OLD = ".rpiv/artifacts/evidence/2026-10-19_123-s7-tdd/bindings"
M = "apps/desktop/src/main/"
os.chdir(ROOT)
K = os.path.join(E, "bindings")

new_pairs = {
    "k2-release-without-failall": (
        "      } finally {\n        core.failAll({ kind: \"transport\" });\n      }\n",
        "      }\n",
    ),
    "k3-first-failure-only": (
        "      if (failures.length > 1)\n"
        "        throw new AggregateError(failures, \"Harness session subscribers failed.\");\n",
        "      if (failures.length > 1) throw failures[0];\n",
    ),
    "k4-no-remove-observer": ("      removeObserver();\n", ""),
    "k5-shared-request-gate": (
        "  return {\n    request: (bridge, createCommand, expected) =>\n      Effect.suspend(() => {\n",
        "  let gateClosed = false;\n  return {\n    request: (bridge, createCommand, expected) =>\n"
        "      Effect.suspend(() => {\n"
        "        if (gateClosed) return Effect.fail({ kind: \"unsent\" } as const);\n",
    ),
    "k5-shared-request-gate-close": (
        "    failBridge: (bridge, fault) => failWhere((entry) => entry.bridge === bridge, fault),\n",
        "    failBridge: (bridge, fault) => {\n      gateClosed = true;\n"
        "      failWhere((entry) => entry.bridge === bridge, fault);\n    },\n",
    ),
    "k6-last-failure": (
        "      if (failures.length > 0) throw failures[0];\n",
        "      if (failures.length > 0) throw failures.at(-1);\n",
    ),
    "k7-no-released-guard": ("      if (released) return;\n      released = true;\n", ""),
    "k9-pop": ("next = this.#queued.shift()", "next = this.#queued.pop()"),
    "k10-skip-mismatched": (
        "    settle(\n      message.causationId,\n      entry.expected === message.event\n"
        "        ? Effect.succeed(message.payload)\n"
        "        : Effect.fail({ kind: \"desktop\", reason: \"mismatched-event\" }),\n    );\n",
        "    if (entry.expected !== message.event) return;\n"
        "    settle(message.causationId, Effect.succeed(message.payload));\n",
    ),
}
for name, (old, new) in new_pairs.items():
    open(os.path.join(K, f"{name}.old"), "w", encoding="utf8", newline="\n").write(old)
    open(os.path.join(K, f"{name}.new"), "w", encoding="utf8", newline="\n").write(new)
for f in os.listdir(OLD):
    shutil.copy2(os.path.join(OLD, f), os.path.join(K, f))

vitest = ["pnpm", "exec", "vitest", "run", "--project", "desktop-main"]
shared_row = ""  # the rendered row name is quoted, so -t matches the bare row name
runs = [
    # The ten from the first build, with their first-build commands.
    ("b1-unguarded-send", M + "harness-request-core.ts", [M + "harness-request-core.test.ts", "-t", "throwing send"]),
    ("b2-null-rule-for-all-events", M + "harness-request-core.ts", [M + "harness-request-core.test.ts", "-t", "ignores non-reply events"]),
    ("b3-unguarded-decode", M + "project-storage-bridge.ts", [M + "project-storage-bridge.test.ts", "-t", "settles an undecodable reply as protocol"]),
    ("b4-immediate-nested-delivery", M + "harness-session.ts", [M + "harness-session.test.ts"]),
    ("b4-flag-reset-outside-finally", M + "harness-session.ts", [M + "harness-session.test.ts", "-t", "drains queued emits before rethrowing a listener failure"]),
    ("b5-unsubscribe-before-settle", M + "workspace-bridge.ts", [M + "workspace-bridge.test.ts", "-t", "settles pending work even when session unsubscribe throws"]),
    ("b7-dispose-without-release", M + "desktop-runtime.ts", [M + "desktop-runtime.test.ts", "-t", "releases every owner on dispose"]),
    ("b10-release-skips-a-stop", M + "harness-bridges.ts", [M + "harness-bridges.test.ts", "-t", "release answers and order"]),
    ("b10-release-stops-at-first-throw", M + "harness-bridges.ts", [M + "harness-bridges.test.ts", "-t", "a throwing shared stop"]),
    ("b10-stop-settles-every-bridge", M + "project-entry-bridge.ts", [M + "harness-bridges.test.ts", "-t", "stop scoped to its bridge"]),
    # The eight of the fix round.
    ("k2-release-without-failall", M + "harness-bridges.ts", [M + "harness-bridges.test.ts", "-t", shared_row + "a throwing shared stop"]),
    ("k3-first-failure-only", M + "harness-session.ts", [M + "harness-session.test.ts", "-t", "throws every listener failure at once after the drain"]),
    ("k4-no-remove-observer", M + "workspace-bridge.ts", [M + "harness-bridges.test.ts", "-t", shared_row + "notifications after stop"]),
    ("k5-shared-request-gate", None, [M + "harness-bridges.test.ts", "-t", shared_row + "stop scoped to its bridge"]),
    ("k6-last-failure", M + "harness-bridges.ts", [M + "harness-bridges.test.ts", "-t", shared_row + "release with two failures"]),
    ("k7-no-released-guard", M + "harness-bridges.ts", [M + "harness-bridges.test.ts", "-t", shared_row + "release twice"]),
    ("k9-pop", M + "harness-session.ts", [M + "harness-session.test.ts", "-t", "delivers queued emits in the order they were queued"]),
    ("k10-skip-mismatched", M + "harness-request-core.ts", [M + "harness-bridges.test.ts", "-t", shared_row + "cross-bridge correlated reply"]),
]
only = set(sys.argv[1:])
for name, source, args in runs:
    if only and name not in only:
        continue
    if source is None:
        # Two replacements in the core: the gate and where a bridge stop closes it.
        core = M + "harness-request-core.ts"
        command = [sys.executable, "-I", os.path.join(E, "bind2.py"), f"bind-{name}",
                   f"{core}={name}", "--", *vitest, *args]
        # bind2 takes one replacement per file: chain the two snippets into one stem.
        o1 = open(os.path.join(K, f"{name}.old"), encoding="utf8").read()
        n1 = open(os.path.join(K, f"{name}.new"), encoding="utf8").read()
        o2 = open(os.path.join(K, f"{name}-close.old"), encoding="utf8").read()
        n2 = open(os.path.join(K, f"{name}-close.new"), encoding="utf8").read()
        text = open(core, encoding="utf8").read()
        start, end = text.index(o1), text.index(o2) + len(o2)
        span = text[start:end]
        open(os.path.join(K, f"{name}-span.old"), "w", encoding="utf8", newline="\n").write(span)
        open(os.path.join(K, f"{name}-span.new"), "w", encoding="utf8", newline="\n").write(
            span.replace(o1, n1).replace(o2, n2))
        command[4] = f"{core}={name}-span"
    else:
        command = [sys.executable, "-I", os.path.join(E, "bind.py"), source,
                   os.path.join(K, f"{name}.old"), os.path.join(K, f"{name}.new"),
                   f"bind-{name}", *vitest, *args]
    result = subprocess.run(command, capture_output=True, text=True)
    print(f"== {name}\n{result.stdout.strip()}\n{result.stderr.strip()}")
