import type { ObserverClock } from "../../src/registration/observer-clock.js";

/** A clock the test moves by hand; `at` fires due timers and answers the next observer event. */
export function manualClock() {
  let now = 0;
  const timers = new Set<{ at: number; callback: () => void }>();
  const events: Array<"waiting" | "done"> = [];
  let listener: ((event: "waiting" | "done") => void) | undefined;
  const emit = (event: "waiting" | "done") => {
    if (listener === undefined) events.push(event);
    else {
      const notify = listener;
      listener = undefined;
      notify(event);
    }
  };
  const schedule = (milliseconds: number, callback: () => void) => {
    const timer = { at: now + milliseconds, callback };
    timers.add(timer);
    return () => {
      timers.delete(timer);
    };
  };
  const clock: ObserverClock = {
    now: () => now,
    schedule,
    wait: (milliseconds) =>
      new Promise((resolve) => {
        schedule(milliseconds, resolve);
        emit("waiting");
      }),
  };
  const jump = (time: number) => {
    if (time < now) throw new Error("The fixture clock cannot go backwards.");
    now = time;
    let fired = 0;
    for (const timer of [...timers]) {
      if (timer.at <= now) {
        timers.delete(timer);
        timer.callback();
        fired += 1;
      }
    }
    return fired;
  };
  const nextEvent = (): Promise<"waiting" | "done"> =>
    new Promise((resolve) => {
      const event = events.shift();
      if (event === undefined) listener = resolve;
      else resolve(event);
    });
  return {
    clock,
    jump,
    nextEvent,
    follow: (work: Promise<unknown>) => {
      void work.then(
        () => emit("done"),
        () => emit("done"),
      );
    },
    at: (time: number): Promise<"waiting" | "done"> => {
      const fired = jump(time);
      if (fired === 0) return Promise.resolve("waiting");
      return nextEvent();
    },
  };
}
