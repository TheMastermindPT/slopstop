/**
 * Opt-in timeout instrumentation for issue #94, off unless `SLOPSTOP_TRACE_94=1`.
 *
 * Off, every helper returns its input or a plain `Error(label)` and records nothing. On, events
 * buffer per test and flush as JSONL to `SLOPSTOP_TRACE_94_DIR` (default
 * `<tmpdir>/slopstop-trace-94`), one file per process and thread. This module imports only Node
 * built-ins, so plain Node can load it with type stripping.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { threadId } from "node:worker_threads";

/** Whether this process records #94 trace events. Read once at load. */
export const trace94Enabled = process.env["SLOPSTOP_TRACE_94"] === "1";

// Captured at load: tests spy on `performance.now` and install fake timers.
const now = performance.now.bind(performance);
const wallNow = Date.now.bind(Date);
const slowMs = Number(process.env["SLOPSTOP_TRACE_94_SLOW_MS"] ?? "3000");
const outsideTest = "outside-test";

/** A timed step: a libSQL call through `traced94`, a transport exchange or a fixture step. */
export type Step94 = Readonly<{
  kind: "call" | "exchange" | "step";
  label: string;
  detail?: unknown;
}>;

/** One Vitest test as the trace names it. */
export type Test94 = Readonly<{ id: string; name: string; file: string }>;

/** The end of one test, or its abort at the timeout, with free-form measurements. */
export type TestEnd94 = Readonly<{ test: string; outcome: string; extra: unknown }>;

/** One runner phase (beforeEach, callback, afterEach, cleanup) and when it started. */
export type Span94 = Readonly<{ name: string; test: string | undefined; startMs: number }>;

type Trace94Event = Readonly<{ kind: string; test: string; tMs: number }> &
  Readonly<Record<string, unknown>>;

type InFlight = Step94 & Readonly<{ test: string; startMs: number }>;

type TestSlot = Test94 & { startMs: number; events: Trace94Event[] };

type Trace94State = {
  readonly output: string;
  readonly tests: Map<string, TestSlot>;
  readonly kept: Map<string, boolean>;
  readonly aborted: Set<string>;
  readonly inFlight: Map<number, InFlight>;
  current: string;
  nextId: number;
  ready: boolean;
};

declare global {
  // One state per process and thread, shared by every module instance (setup, runner, fixtures).
  var slopstopTrace94: Trace94State | undefined;
}

function state(): Trace94State {
  if (globalThis.slopstopTrace94 !== undefined) return globalThis.slopstopTrace94;
  const directory =
    process.env["SLOPSTOP_TRACE_94_DIR"] ?? path.join(tmpdir(), "slopstop-trace-94");
  const created: Trace94State = {
    output: path.join(directory, `${process.pid}-${threadId}.jsonl`),
    tests: new Map(),
    kept: new Map(),
    aborted: new Set(),
    inFlight: new Map(),
    current: outsideTest,
    nextId: 1,
    ready: false,
  };
  globalThis.slopstopTrace94 = created;
  return created;
}

function write(lines: readonly Trace94Event[]): void {
  if (lines.length === 0) return;
  const current = state();
  if (!current.ready) {
    mkdirSync(path.dirname(current.output), { recursive: true });
    current.ready = true;
  }
  const header = { v: 1, pid: process.pid, tid: threadId };
  const text = lines.map((line) => JSON.stringify({ ...header, ...line }, jsonSafe)).join("\n");
  appendFileSync(current.output, `${text}\n`);
}

function jsonSafe(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}

/** Stores one event for its test, or writes it at once when that test already flushed. */
function record(event: Trace94Event): void {
  const current = state();
  const kept = current.kept.get(event.test);
  if (kept !== undefined) {
    if (kept) write([event]);
    return;
  }
  const slot = current.tests.get(event.test);
  if (slot === undefined) write([event]);
  else slot.events.push(event);
}

/** One event for the current test, unless `fields` names its own `test`. */
function event(kind: string, fields: Readonly<Record<string, unknown>>): Trace94Event {
  return { test: state().current, ...fields, kind, tMs: now(), wall: wallNow() };
}

/** A short JSON form of any value, for status envelopes and step replies. */
function describe94(value: unknown): unknown {
  try {
    const text = JSON.stringify(value, jsonSafe);
    if (text === undefined) return String(value);
    return text.length > 4000 ? `${text.slice(0, 4000)}…` : JSON.parse(text);
  } catch {
    return String(value);
  }
}

/**
 * The error a fixture throws when an expected envelope is missing. Its message is always `label`;
 * with tracing on, the actual envelope is also recorded.
 */
export function missing94(label: string, actual: unknown): Error {
  const error = new Error(label);
  Error.captureStackTrace(error, missing94);
  if (trace94Enabled) record(event("missing", { label, actual: describe94(actual) }));
  return error;
}

/** Starts one timed step and answers its id, or 0 when tracing is off. */
export function begin94(step: Step94): number {
  if (!trace94Enabled) return 0;
  const current = state();
  const id = current.nextId++;
  current.inFlight.set(id, { ...step, test: current.current, startMs: now() });
  const fields = { id, label: step.label, detail: step.detail, concurrent: concurrentOn(step) };
  record(event(`${step.kind}-start`, fields));
  return id;
}

/** Ends the step `id`; a step that ends after its test was aborted is a late settle. */
export function end94(id: number, outcome?: unknown): void {
  if (id === 0) return;
  const current = state();
  const started = current.inFlight.get(id);
  if (started === undefined) return;
  current.inFlight.delete(id);
  const kind = current.aborted.has(started.test) ? "late-settle" : `${started.kind}-end`;
  const durMs = now() - started.startMs;
  record(event(kind, { id, test: started.test, label: started.label, durMs, outcome }));
}

/** How many other steps of the same client (label root) are in flight. */
function concurrentOn(step: Step94): number {
  const root = step.label.split(".")[0];
  let count = 0;
  for (const call of state().inFlight.values()) if (call.label.split(".")[0] === root) count++;
  return count - 1;
}

/** The SQL head of a libSQL statement argument. */
function sqlHead(statement: unknown): string | undefined {
  const sql = typeof statement === "string" ? statement : Reflect.get(Object(statement), "sql");
  return typeof sql === "string" ? sql.replace(/\s+/g, " ").trim().slice(0, 80) : undefined;
}

/**
 * Wraps a libSQL client (or transaction) so each async call is timed. Off, it answers `target`
 * itself. On, each call answers a promise derived from the original: it settles one microtask
 * later and rejects exactly when the original rejects, so an unobserved rejection stays unhandled
 * and visible to Vitest. Use it only where an extra microtask cannot change an interleaving under
 * test.
 */
export function traced94<T extends object>(target: T, label: string): T {
  if (!trace94Enabled) return target;
  return new Proxy(target, {
    get(object, property) {
      // The real object is the receiver: libSQL clients keep private fields.
      const value: unknown = Reflect.get(object, property);
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => {
        const op = String(property);
        const step: Step94 = { kind: "call", label, detail: { op, sql: sqlHead(args[0]) } };
        return observe(Reflect.apply(value, object, args), step);
      };
    },
  });
}

function observe(result: unknown, step: Step94): unknown {
  if (!(result instanceof Promise)) return result;
  return timed(result, step, (value: unknown) =>
    opensTransaction(step, value) ? traced94(value, `${step.label}.tx`) : value,
  );
}

/**
 * Times `promise` as `step` and answers a derived promise that settles one microtask later with
 * `map(value)`, or rejects exactly when `promise` rejects.
 */
function timed<T, R>(promise: Promise<T>, step: Step94, map: (value: T) => R): Promise<R> {
  const id = begin94(step);
  return promise.then(
    (value) => {
      end94(id, { ok: true });
      return map(value);
    },
    (error: unknown) => {
      end94(id, { ok: false, error: error instanceof Error ? error.name : typeof error });
      throw error;
    },
  );
}

/**
 * Runs one fixture step. Off, it answers `run()` itself. On, it times the step like `traced94`
 * times a call, with the same derived-promise rule.
 */
export function step94<T>(label: string, run: () => Promise<T>): Promise<T> {
  const result = run();
  if (!trace94Enabled) return result;
  return timed(result, { kind: "step", label }, (value) => value);
}

function opensTransaction(step: Step94, value: unknown): value is object {
  const op = Reflect.get(Object(step.detail), "op");
  return op === "transaction" && typeof value === "object" && value !== null;
}

/** Opens the trace slot of one test; later events without an explicit test belong to it. */
export function enterTest94(test: Test94): void {
  if (!trace94Enabled) return;
  const current = state();
  current.current = test.id;
  current.tests.set(test.id, { ...test, startMs: now(), events: [] });
}

/** Records one runner phase span that ends now. */
export function span94(span: Span94): void {
  if (!trace94Enabled) return;
  const fields = { test: span.test ?? outsideTest, name: span.name, startMs: span.startMs };
  record(event("span", { ...fields, durMs: now() - span.startMs }));
}

/** The monotonic clock this module uses, unaffected by spies and fake timers. */
export const clock94 = now;

/** Dumps what is in flight when a test is aborted at its timeout; `outcome` is the reason. */
export function abortTest94(abort: TestEnd94): void {
  if (!trace94Enabled) return;
  const current = state();
  current.aborted.add(abort.test);
  const at = now();
  const inFlight = [...current.inFlight.entries()].map(([id, call]) => ({
    id,
    test: call.test,
    kind: call.kind,
    label: call.label,
    ageMs: at - call.startMs,
    detail: call.detail,
  }));
  const resources = countBy(process.getActiveResourcesInfo());
  const fields = { test: abort.test, reason: abort.outcome, extra: abort.extra };
  record(event("abort", { ...fields, inFlight, resources }));
}

function countBy(values: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

/**
 * Closes the slot of a test and writes its summary. Call and step events are kept only for tests
 * that failed, were aborted or ran longer than `SLOPSTOP_TRACE_94_SLOW_MS`; missing-envelope,
 * abort and span events are always kept.
 */
export function finishTest94(end: TestEnd94): void {
  if (!trace94Enabled) return;
  const current = state();
  const slot = current.tests.get(end.test);
  if (slot === undefined) return;
  current.tests.delete(end.test);
  if (current.current === end.test) current.current = outsideTest;
  const durMs = now() - slot.startMs;
  const keep = end.outcome !== "pass" || current.aborted.has(end.test) || durMs > slowMs;
  const detail = keep ? slot.events : slot.events.filter((line) => alwaysKept.has(line.kind));
  const summary = { test: end.test, name: slot.name, file: slot.file, state: end.outcome };
  write([...detail, event("summary", { ...summary, durMs, keep, extra: end.extra })]);
  current.kept.set(end.test, keep);
}

const alwaysKept = new Set(["missing", "abort", "span"]);
