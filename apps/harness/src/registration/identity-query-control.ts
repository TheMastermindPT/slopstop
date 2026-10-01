export type IdentityQueryControl = Readonly<{
  signal: AbortSignal;
  deadline: number;
  cancelledAt(): number | undefined;
}>;

export function identityQueryInterruption(control: IdentityQueryControl) {
  const cancelledAt = control.cancelledAt();
  if (cancelledAt !== undefined && cancelledAt < control.deadline) {
    return { status: "cancelled" } as const;
  }
  if (performance.now() >= control.deadline) {
    return { status: "unavailable", code: "OBSERVATION_LIMIT_EXCEEDED" } as const;
  }
  if (control.signal.aborted) return { status: "cancelled" } as const;
  return undefined;
}

export function createIdentityQueryControl(signal?: AbortSignal) {
  const controller = new AbortController();
  const deadline = performance.now() + 10000;
  let cancelledAt: number | undefined;
  controller.signal.addEventListener(
    "abort",
    () => {
      cancelledAt ??= performance.now();
    },
    { once: true },
  );
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(abort, 10000);
  return {
    controller,
    control: { signal: controller.signal, deadline, cancelledAt: () => cancelledAt },
    dispose: () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    },
  };
}
