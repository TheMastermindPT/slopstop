import type { HarnessStatus } from "@slopstop/protocol";
import { useEffect, useState } from "react";
import { ProjectsWorkspace } from "./projects-workspace.js";
import {
  HarnessStatusLine,
  HarnessStrip,
  type RetryFailure,
  type StatusCopy,
  useStripShown,
} from "./shell/harness-strip.js";

const initialStatus: HarnessStatus = {
  state: "starting",
  attempt: 1,
};

function copyForStatus(status: HarnessStatus): StatusCopy {
  switch (status.state) {
    case "starting":
      return {
        heading: "Harness starting",
        detail: `Establishing process link, attempt ${status.attempt}.`,
      };
    case "ready":
      return {
        heading: "Harness ready",
        detail: `Protocol link established with harness ${status.harnessVersion}.`,
      };
    case "degraded":
      return {
        heading: "Harness recovering",
        detail: status.diagnostic.message,
      };
    case "crashed":
      return {
        heading: "Harness unavailable",
        detail: status.diagnostic.message,
      };
    case "stopped":
      return {
        heading: "Harness stopped",
        detail: "The utility process is not running.",
      };
  }
}

/** A retry the desktop process never answered: a failure of its own, never a silent one. */
const retryBridgeFailure: RetryFailure = {
  code: "DESKTOP_RETRY_FAILED",
  message: "Retry could not reach the desktop process.",
};

/** Whether `state` is an outcome that ends a pending retry: starting and recovering are not. */
const endsRetry = (state: HarnessStatus["state"]) => state !== "starting" && state !== "degraded";

function bridgeFailure(): HarnessStatus {
  return {
    state: "crashed",
    attempt: 0,
    canRetry: true,
    diagnostic: {
      code: "DESKTOP_BRIDGE_FAILED",
      message: "The desktop bridge could not read harness status.",
    },
  };
}

export function App() {
  const [status, setStatus] = useState<HarnessStatus>(initialStatus);
  const [retryFailure, setRetryFailure] = useState<RetryFailure | null>(null);
  // A pressed retry waits for its outcome: ready, unavailable again, or a refusal.
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    let active = true;
    let notified = false;
    /**
     * A pending retry ends at an outcome: ready, unavailable again, or stopped. Starting and
     * recovering are part of the attempt. Only unavailable keeps a refused retry's message.
     */
    const apply = (next: HarnessStatus) => {
      setStatus(next);
      if (endsRetry(next.state)) setRetrying(false);
      if (next.state !== "crashed") setRetryFailure(null);
    };
    const unsubscribe = window.slopstop.subscribeHarnessStatus((next) => {
      notified = true;
      apply(next);
    });

    void window.slopstop
      .getHarnessStatus()
      .then((nextStatus) => {
        if (active && !notified) {
          apply(nextStatus);
        }
      })
      .catch(() => {
        if (active) {
          apply(bridgeFailure());
        }
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const copy = copyForStatus(status);
  const stripShown = useStripShown(status.state);

  function retryHarness(): void {
    setRetryFailure(null);
    setRetrying(true);
    const refused = (failure: RetryFailure) => {
      setRetrying(false);
      setRetryFailure(failure);
    };
    window.slopstop.retryHarness().then(
      (result) => {
        if (!result.ok) refused(result.error);
      },
      () => refused(retryBridgeFailure),
    );
  }

  return (
    <ProjectsWorkspace
      status={status}
      strip={
        <>
          <HarnessStatusLine copy={copy} />
          {stripShown && status.state !== "ready" ? (
            <HarnessStrip
              status={status}
              copy={copy}
              retrying={retrying}
              retryFailure={retryFailure}
              onRetry={retryHarness}
            />
          ) : null}
        </>
      }
    />
  );
}
