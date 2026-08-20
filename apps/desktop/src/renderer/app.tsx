import type { HarnessStatus } from "@slopstop/protocol";
import { useEffect, useState, useTransition } from "react";
import styles from "./app.module.css";

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
    const unsubscribe = window.slopstop.subscribeHarnessStatus(setStatus);

    void window.slopstop
      .getHarnessStatus()
      .then((nextStatus) => {
        if (active) {
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
    <main className={styles["shell"]}>
      <div className={styles["coordinates"]} aria-hidden="true">
        <span>SLP / 00</span>
        <span>LOCAL SYSTEM</span>
        <span>UTC LINK</span>
      </div>

      <section className={styles["instrument"]} aria-labelledby="product-name">
        <div className={styles["reticle"]} data-state={status.state} aria-hidden="true">
          <span className={styles["orbit"]} />
          <span className={styles["beacon"]} />
        </div>

        <div className={styles["readout"]}>
          <p className={styles["coordinate"]}>{copy.coordinate}</p>
          <h1 id="product-name">SlopStop</h1>
          <div className={styles["status"]} role="status" aria-live="polite">
            <strong>{copy.heading}</strong>
            <span>{copy.detail}</span>
          </div>

          {canRetry ? (
            <button type="button" onClick={retryHarness} disabled={isRetrying}>
              {isRetrying ? "Retrying harness" : "Retry harness"}
            </button>
          ) : null}

          {retryMessage ? <p className={styles["retryError"]}>{retryMessage}</p> : null}
        </div>
      </section>

      <footer>
        <span>PRIVATE LOCAL INSTRUMENT</span>
        <span>FOUNDATION / 0.0.0</span>
      </footer>
    </main>
  );
}
