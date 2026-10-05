---
date: 2026-10-05
author: coordenador-claude (Claude Code), for Pedro Mesquita
repository: slopstop
status: draft-not-posted
target: https://github.com/tursodatabase/libsql-js/issues/new
tags: [libsql, upstream, crash, windows]
---

# Draft upstream issue (not posted; needs the user's approval)

Related open issues to link: #228, #230, #231.

---

**Title:** Use-after-free (0xC0000005) in a N-API finalizer calling sqlite3_close on an already freed connection (Windows, worker_threads)

**Environment**

- `libsql` 0.5.29 (`@libsql/win32-x64-msvc`), used through `@libsql/client` 0.17.4 (local file databases).
- Node v24.20.0 on Windows 11 x64. Also seen with `libsql` 0.6.0-pre.43 (crash rate similar; not dumped).
- The client lives in a Node `worker_thread` that stays alive. Requests are serialised, one at a time. After closing a client we call `global.gc()` once, because on Windows the database files are only released when the native objects are finalized (see #228 and #230).

**Symptom**

The process dies intermittently with `0xC0000005`, in about 12% of 14-second runs of one test file. The file opens databases, runs short transactions, cancels work mid-way with `AbortController`, and closes clients in `finally`. It is timing-sensitive: adding synchronous logging hides it.

**Full-memory dump analysis** (official Node PDBs; `index.node` has export symbols only)

- **Exception.** Read access violation at `index.node+0x55661e`, instruction `movzx eax, byte ptr [rax+71h]`. The address in `rax` is in a decommitted heap region (`MEM_RESERVE`), i.e. freed memory.
- **Crashing thread.** It is the Node worker thread (`WorkerThread`), not a libsql or tokio thread. Its stack, top first:

  ```
  index.node (8 frames, unnamed Rust drop code)
  node!node_napi_env__::CallFinalizer
  node!v8impl::Reference::Finalize
  node!node_napi_env__::DrainFinalizerQueue / EnqueueFinalizer lambda (node_api.cc)
  node!node::Environment::RunAndClearNativeImmediates
  node!node::Environment::CheckImmediate
  node!uv__check_invoke -> uv_run -> node::SpinEventLoopInternal
  node!node::worker::Worker::Run
  ```

- **Other threads.** All 12 `tokio-runtime-worker` threads, the main thread and the V8/libuv pools were idle. Nothing else was touching libsql.
- **The faulting frames.** From disassembly, the top frames match SQLite's `sqlite3_close(db)` -> `sqlite3Close(db, 0)` -> `sqlite3SafetyCheckSickOrOk(db)`. That check reads `db->eOpenState`, which sits at offset `0x71` in the 64-bit `sqlite3` struct. This is an inference from the struct layout; we could not confirm it with symbols.

**Reading**

A GC finalizer of a libsql handle calls `sqlite3_close` on a `sqlite3*` that another owner had already closed and freed. That is a double close, or a use-after-free of the connection, in the finalizer path. In 0.5.29, `Database.close()` only drops its reference, and the connection is really closed by whichever native object is finalized last (#228). That makes this path the normal way connections close, and it explains why the crash depends on timing.

**What we can share**

- A minimal reproduction is not yet isolated from our test suite. We can work on one if useful.
- The faulting offset, the instruction and the full symbolized Node frames are above. We can capture more dumps.

---

## Notes for the user (not part of the issue)

- **Personal data.** The draft contains no paths, user names, email or project code.
- **Posting.** It is posted from your GitHub account (with `gh issue create` or the web). Once posted it is public and permanent.
- **Repository name.** The draft names libsql's GitHub repository. Check that it is still the correct one before posting.
