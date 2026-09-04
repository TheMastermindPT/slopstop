import { expect, it, vi } from "vitest";
import { createHarnessPortCloseHandler } from "./process-shutdown.js";

it("observes one runtime shutdown rejection without forwarding its cause", async () => {
  const privateFailure = new Error("C:\\private\\project\\slopstop.db");
  const stopRuntime = vi.fn(() => Promise.reject(privateFailure));
  const succeeded = vi.fn();
  const failed = vi.fn();
  const close = createHarnessPortCloseHandler({ stopRuntime, succeeded, failed });

  close();
  close();

  await vi.waitFor(() => expect(failed).toHaveBeenCalledOnce());
  expect(stopRuntime).toHaveBeenCalledOnce();
  expect(succeeded).not.toHaveBeenCalled();
  expect(failed).toHaveBeenCalledWith("Harness shutdown failed.");
  expect(JSON.stringify(failed.mock.calls)).not.toContain(privateFailure.message);
});

it("converts a synchronous runtime shutdown throw once", async () => {
  const privateFailure = new Error("C:\\private\\project\\synchronous.db");
  const stopRuntime = vi.fn(() => {
    throw privateFailure;
  });
  const succeeded = vi.fn();
  const failed = vi.fn();
  const close = createHarnessPortCloseHandler({ stopRuntime, succeeded, failed });

  expect(() => {
    close();
    close();
  }).not.toThrow();

  await vi.waitFor(() => expect(failed).toHaveBeenCalledOnce());
  expect(stopRuntime).toHaveBeenCalledOnce();
  expect(succeeded).not.toHaveBeenCalled();
  expect(failed).toHaveBeenCalledWith("Harness shutdown failed.");
  expect(JSON.stringify(failed.mock.calls)).not.toContain(privateFailure.message);
});
