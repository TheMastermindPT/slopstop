"""#123 s6 M1 binding helper: one exact replacement in each of several files.

Usage: python bind2.py <log-name> <source>=<snippet-stem> [...] -- <command...>
For every pair it backs the source up and replaces the one exact occurrence of
bindings/<stem>.old with bindings/<stem>.new. Then it runs the command through
tdd-run.sh (log <log-name>.log), restores every source by copy, and checks that
each restored blob and the working-tree tree equal the ones before the binding.
"""
import hashlib, os, shutil, subprocess, sys, tempfile

here = os.path.dirname(os.path.abspath(__file__))
# Git Bash, never the WSL launcher that a bare "bash" can resolve to on Windows.
bash = os.environ.get("S6_BASH", "C:/Program Files/Git/usr/bin/bash.exe")
args = sys.argv[1:]
split = args.index("--")
log_name, pairs, command = args[0], args[1:split], args[split + 1:]
sha = lambda path: hashlib.sha256(open(path, "rb").read()).hexdigest()

def tree():
    out = subprocess.run([bash, os.path.join(here, "tdd-run.sh"), "_tree", "true"],
                         capture_output=True, text=True).stdout
    os.remove(os.path.join(here, "_tree.log"))
    return out.split("tree=")[1].split()[0]

plans = []
for pair in pairs:
    source, stem = pair.split("=")
    old = open(os.path.join(here, "bindings", f"{stem}.old"), encoding="utf8").read()
    new = open(os.path.join(here, "bindings", f"{stem}.new"), encoding="utf8").read()
    text = open(source, encoding="utf8", newline="").read()
    if text.count(old) != 1:
        sys.exit(f"bind2: {stem} occurs {text.count(old)} times in {source}")
    plans.append((source, stem, text.replace(old, new)))

before_tree = tree()
backups = tempfile.mkdtemp(prefix="s6-bind2-")
before = {}
for index, (source, _, _) in enumerate(plans):
    before[source] = sha(source)
    shutil.copy2(source, os.path.join(backups, str(index)))
bound = {}
try:
    for source, _, text in plans:
        open(source, "w", encoding="utf8", newline="").write(text)
        bound[source] = sha(source)
    result = subprocess.run([bash, os.path.join(here, "tdd-run.sh"), log_name, *command],
                            capture_output=True, text=True)
    print(result.stdout.strip())
finally:
    for index, (source, _, _) in enumerate(plans):
        shutil.copy2(os.path.join(backups, str(index)), source)
after_tree = tree()
lines = []
for source, stem, _ in plans:
    restored = sha(source)
    lines.append(f"binding {stem}: source {source} bound blob {bound[source][:16]}; restored blob "
                 f"{restored[:16]} (backup {before[source][:16]}) "
                 f"{'MATCH' if restored == before[source] else 'MISMATCH'}")
lines.append(f"tree before {before_tree} after {after_tree} "
             f"{'MATCH' if before_tree == after_tree else 'MISMATCH'}")
with open(os.path.join(here, f"{log_name}.log"), "a", encoding="utf8") as log:
    log.write("\n".join(lines) + "\n")
print("\n".join(lines))
