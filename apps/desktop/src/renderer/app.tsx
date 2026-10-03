import type { HarnessStatus } from "@slopstop/protocol";
import { useEffect, useState, useTransition } from "react";
import { ProjectsWorkspace } from "./projects-workspace.js";

const initialStatus: HarnessStatus = {
  state: "starting",
  attempt: 1,
};

type StatusCopy = Readonly<{
  heading: string;
  detail: string;
  coordinate: string;
}>;

function copyForStatus(status: HarnessStatus): StatusCopy {
  switch (status.state) {
    case "starting":
      return {
        heading: "Harness starting",
        detail: `Establishing process link, attempt ${status.attempt}.`,
        coordinate: "LINK / ACQUIRING",
      };
    case "ready":
      return {
        heading: "Harness ready",
        detail: `Protocol link established with harness ${status.harnessVersion}.`,
        coordinate: "LINK / LOCKED",
      };
    case "degraded":
      return {
        heading: "Harness recovering",
        detail: status.diagnostic.message,
        coordinate: "LINK / RECOVERY",
      };
    case "crashed":
      return {
        heading: "Harness unavailable",
        detail: status.diagnostic.message,
        coordinate: "LINK / LOST",
      };
    case "stopped":
      return {
        heading: "Harness stopped",
        detail: "The utility process is not running.",
        coordinate: "LINK / OFFLINE",
      };
  }
}

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
  const [retryMessage, setRetryMessage] = useState<string | null>(null);
  const [isRetrying, startRetry] = useTransition();

  useEffect(() => {
    let active = true;
    let notified = false;
    const unsubscribe = window.slopstop.subscribeHarnessStatus((next) => {
      notified = true;
      setStatus(next);
    });

    void window.slopstop
      .getHarnessStatus()
      .then((nextStatus) => {
        if (active && !notified) {
          setStatus(nextStatus);
        }
      })
      .catch(() => {
        if (active) {
          setStatus(bridgeFailure());
        }
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const copy = copyForStatus(status);
  const canRetry = status.state === "crashed" && status.canRetry;

  function retryHarness(): void {
    setRetryMessage(null);
    startRetry(async () => {
      const result = await window.slopstop.retryHarness();
      if (!result.ok) {
        setRetryMessage(result.error.message);
      }
    });
  }

  return (
    <ProjectsWorkspace
      status={status}
      header={
        <>
          <div role="status" aria-live="polite">
            <strong>{copy.heading}</strong>
            <span>{copy.detail}</span>
          </div>

          {canRetry ? (
            <button type="button" onClick={retryHarness} disabled={isRetrying}>
              {isRetrying ? "Retrying harness" : "Retry harness"}
            </button>
          ) : null}

          {retryMessage ? <p role="alert">{retryMessage}</p> : null}
        </>
      }
    />
  );
}
