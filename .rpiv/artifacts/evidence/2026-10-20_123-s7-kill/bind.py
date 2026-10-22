"""#123 s6 binding observation helper.

Usage: python bind.py <source> <old-snippet-file> <new-snippet-file> <log-name> <command...>
Backs the source up, replaces the one exact occurrence of the old snippet with the new one,
runs the command through tdd-run.sh (log <log-name>.log), restores the source by copy, and
checks that the restored blob and the working-tree digest equal the ones before the binding.
"""
import hashlib, os, shutil, subprocess, sys, tempfile

here = os.path.dirname(os.path.abspath(__file__))
# Git Bash, never the WSL launcher that a bare "bash" can resolve to on Windows.
bash = os.environ.get("S6_BASH", "C:/Program Files/Git/usr/bin/bash.exe")
source, old_file, new_file, log_name, *command = sys.argv[1:]
old = open(old_file, encoding="utf8").read()
new = open(new_file, encoding="utf8").read()
text = open(source, encoding="utf8", newline="").read()
if text.count(old) != 1:
    sys.exit(f"bind: old snippet occurs {text.count(old)} times in {source}")
sha = lambda path: hashlib.sha256(open(path, "rb").read()).hexdigest()
def digest():
    out = subprocess.run([bash, os.path.join(here, "tdd-run.sh"), "_digest", "true"],
                         capture_output=True, text=True).stdout
    return out.split("tree=")[1].split()[0]
before_sha, before_digest = sha(source), digest()
backup = os.path.join(tempfile.mkdtemp(prefix="s6-bind-"), os.path.basename(source))
shutil.copy2(source, backup)
try:
    open(source, "w", encoding="utf8", newline="").write(text.replace(old, new))
    bound_sha = sha(source)
    result = subprocess.run([bash, os.path.join(here, "tdd-run.sh"), log_name, *command],
                            capture_output=True, text=True)
    print(result.stdout.strip())
finally:
    shutil.copy2(backup, source)
after_sha, after_digest = sha(source), digest()
os.remove(os.path.join(here, "_digest.log"))
line = (f"binding: source {source} bound blob {bound_sha[:16]}; restored blob {after_sha[:16]} "
        f"(backup {before_sha[:16]}) {'MATCH' if after_sha == before_sha else 'MISMATCH'}; "
        f"tree before {before_digest} after {after_digest} "
        f"{'MATCH' if before_digest == after_digest else 'MISMATCH'}")
with open(os.path.join(here, f"{log_name}.log"), "a", encoding="utf8") as log:
    log.write(line + "\n")
print(line)
