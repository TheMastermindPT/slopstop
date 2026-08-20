import type { HarnessStatus } from "@slopstop/protocol";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { SlopStopApi } from "../shared/desktop-api.js";
import { App } from "./app.js";

const startingStatus: HarnessStatus = {
  state: "starting",
  attempt: 1,
};

const readyStatus: HarnessStatus = {
  state: "ready",
  attempt: 1,
  harnessVersion: "0.0.0",
};

function exposeApi(api: SlopStopApi): void {
  Object.defineProperty(window, "slopstop", {
    configurable: true,
    value: api,
  });
}

describe("desktop shell", () => {
  it("projects harness status updates from the preload API", async () => {
    let notify: ((status: HarnessStatus) => void) | undefined;
    exposeApi({
      getHarnessStatus: async () => startingStatus,
      retryHarness: async () => ({ ok: true }),
      subscribeHarnessStatus: (listener) => {
        notify = listener;
        return () => {
          notify = undefined;
        };
      },
    });

    render(<App />);

    expect((await screen.findByRole("status")).textContent).toContain("Harness starting");

    act(() => {
      notify?.(readyStatus);
    });

    expect(screen.getByRole("status").textContent).toContain("Harness ready");
    expect(screen.queryByRole("button", { name: "Retry harness" })).toBeNull();
  });

  it("offers an explicit retry after the harness exhausts automatic recovery", async () => {
    const retryHarness = vi.fn(async () => ({ ok: true as const }));
    exposeApi({
      getHarnessStatus: async () => ({
        state: "crashed",
        attempt: 3,
        canRetry: true,
        diagnostic: {
          code: "HARNESS_PROCESS_EXITED",
          message: "Harness exited with code 1.",
        },
      }),
      retryHarness,
      subscribeHarnessStatus: () => () => undefined,
    });

    render(<App />);

    const retry = await screen.findByRole("button", { name: "Retry harness" });
    await userEvent.setup().click(retry);

    expect(retryHarness).toHaveBeenCalledOnce();
  });
});
