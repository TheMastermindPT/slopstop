"""S7-K12 check: the Stryker configs parse as JSON, every mutate path exists, and every range falls
inside its file. Prints each range's first and last line so its content can be read. Run from the
worktree root: python -I <this file> stryker.config.json stryker.desktop-s7.config.json"""
import json
import os
import sys

failed = False
for config in sys.argv[1:]:
    data = json.load(open(config, encoding="utf8"))
    print(f"== {config}: parses; {len(data['mutate'])} mutate entries")
    for entry in data["mutate"]:
        if entry.startswith("!"):
            continue
        path, _, span = entry.partition(":")
        if not os.path.isfile(path):
            print(f"MISSING {entry}")
            failed = True
            continue
        if not span:
            continue
        lines = open(path, encoding="utf8").read().split("\n")
        if lines and lines[-1] == "":
            lines.pop()
        first, last = (int(n) for n in span.split("-"))
        inside = 1 <= first <= last <= len(lines)
        failed |= not inside
        print(f"{'ok ' if inside else 'OUT'} {entry} (file {len(lines)} lines)")
        if inside and "desktop/src/main" in path:
            print(f"    {first}: {lines[first - 1].strip()}")
            print(f"    {last}: {lines[last - 1].strip()}")
print("k12-check:", "FAILED" if failed else "OK")
sys.exit(1 if failed else 0)
