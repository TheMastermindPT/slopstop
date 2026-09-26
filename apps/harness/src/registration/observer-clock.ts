import { setTimeout as delay } from "node:timers/promises";

export interface ObserverClock {
  now(): number;
  wait(milliseconds: number): Promise<void>;
  schedule(milliseconds: number, callback: () => void): () => void;
}

export const systemObserverClock: ObserverClock = {
  now: () => performance.now(),
  wait: (milliseconds) => delay(milliseconds),
  schedule: (milliseconds, callback) => {
    const timer = setTimeout(callback, milliseconds);
    return () => clearTimeout(timer);
  },
};
