import type { HarnessStatus } from "@slopstop/protocol";
import { useEffect, useState } from "react";
import { ProjectsWorkspace } from "./projects-workspace.js";
import { HarnessStatusLine, HarnessStrip, useStripShown } from "./shell/harness-strip.js";
import { TitleBar } from "./shell/title-bar.js";

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
  // A pressed retry waits for its outcome: ready, unavailable again, or a refusal.
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    let active = true;
    let notified = false;
    /** A new status ends a pending retry unless it is starting; only unavailable keeps the message. */
    const apply = (next: HarnessStatus) => {
      setStatus(next);
      if (next.state !== "starting") setRetrying(false);
      if (next.state !== "crashed") setRetryMessage(null);
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
    setRetryMessage(null);
    setRetrying(true);
    window.slopstop.retryHarness().then(
      (result) => {
        if (result.ok) return;
        setRetrying(false);
        setRetryMessage(result.error.message);
      },
      () => setRetrying(false),
    );
  }

  return (
    <>
      <TitleBar />
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
                retryMessage={retryMessage}
                onRetry={retryHarness}
              />
            ) : null}
          </>
        }
      />
    </>
  );
}
