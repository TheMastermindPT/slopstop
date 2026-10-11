import { VitestTestRunner } from "vitest/runners";
import { clock94, type Span94, span94 } from "./trace-94.js";

type Trace = VitestTestRunner["trace"];

/**
 * Times one runner phase. It answers the phase's own result, so the runner awaits the same
 * promise; the runner always awaits it, so the observer cannot hide a rejection.
 */
function spanned<T>(span: Omit<Span94, "startMs">, phase: () => T): T {
  const startMs = clock94();
  const stop = () => span94({ ...span, startMs });
  const result = phase();
  if (result instanceof Promise) void result.then(stop, stop);
  else stop();
  return result;
}

function timedTrace(inner: Trace): Trace {
  return <T>(name: string, attributes: Record<string, unknown> | (() => T), cb?: () => T): T => {
    if (!name.startsWith("test.")) return inner(name, attributes, cb);
    const span = { name, test: VitestTestRunner.getCurrentTest()?.id };
    if (typeof attributes === "function") return inner(name, () => spanned(span, attributes));
    return inner(name, attributes, cb && (() => spanned(span, cb)));
  };
}

/** #94: records the beforeEach, callback, afterEach and cleanup span of every test. */
export default class Trace94Runner extends VitestTestRunner {
  constructor(config: ConstructorParameters<typeof VitestTestRunner>[0]) {
    super(config);
    this.trace = timedTrace(this.trace);
  }
}
