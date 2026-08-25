import { CheckCircleIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import { useState } from "react";
import styles from "./prototype-app.module.css";
import { memories } from "./prototype-fixtures.js";

export function ReviewSurface({
  onAccept,
  onReturn,
}: Readonly<{ onAccept: () => void; onReturn: () => void }>) {
  return (
    <section className={styles["review-surface"]} aria-labelledby="review-title">
      <header className={styles["surface-heading"]}>
        <div>
          <span>Frame revision 03 / Complete end-state</span>
          <h1 id="review-title">Review the Frame</h1>
          <p>
            Check the promise, plan, and gaps together before this revision creates map content.
          </p>
        </div>
        <button type="button" className={styles["quiet-button"]} onClick={onReturn}>
          Return to Conversation
        </button>
      </header>
      <div className={styles["review-workspace"]}>
        <section className={styles["review-document"]}>
          <article className={styles["review-lead"]}>
            <div>
              <span>End-state summary</span>
              <strong>A rest timer that resumes honestly.</strong>
            </div>
            <p>
              The active interval survives refresh and browser suspension. Each path has its own
              proof, and a broken path remains visible instead of looking clean.
            </p>
          </article>
          <section>
            <h2>User stories</h2>
            <p>As an athlete, I return to the same active rest interval after reopening the app.</p>
            <p>
              As a developer, I can distinguish a proven refresh restore from an unproven or broken
              suspension restore.
            </p>
          </section>
          <section>
            <h2>Proposed revision diff</h2>
            <div className={styles["revision-diff"]}>
              <span data-change="removed">− Recompute remaining time from the last UI tick.</span>
              <span data-change="added">+ Derive remaining time from durable wall time.</span>
              <span data-change="added">+ Record refresh and suspension Evidence separately.</span>
            </div>
          </section>
          <section>
            <h2>Technical plan</h2>
            <ol>
              <li>Persist one bounded active-session snapshot.</li>
              <li>Restore through the deterministic timer model.</li>
              <li>Prove refresh, suspension, and broken recovery independently.</li>
            </ol>
          </section>
        </section>
        <aside className={styles["traceable-mirror"]}>
          <header>
            <div>
              <h2>Traceable Mirror</h2>
              <span>Expectation → decision → plan</span>
            </div>
            <CheckCircleIcon size={21} weight="fill" />
          </header>
          <div>
            <span>Restore the same interval</span>
            <strong>Wall time is authoritative</strong>
            <small>Waypoint · Session storage</small>
          </div>
          <div>
            <span>Never hide failed recovery</span>
            <strong>Broken remains distinct</strong>
            <small>Waypoint · Suspension proof</small>
          </div>
          <div>
            <span>Bind proof to exact work</span>
            <strong>Evidence follows revision</strong>
            <small>Waypoint · Resume evidence</small>
          </div>
          <section className={styles["checkpoint"]}>
            <span>Decision checkpoint 03</span>
            <strong>3 accepted · 2 proposed · 0 uncovered</strong>
            <p>Corrections will create revision 04; accepted history will not be rewritten.</p>
          </section>
          <button type="button" className={styles["send-button"]} onClick={onAccept}>
            Accept Frame revision
          </button>
        </aside>
      </div>
    </section>
  );
}

export function MemoryLibrarySurface({
  activeMemoryId,
  onReturn,
}: Readonly<{ activeMemoryId: string | undefined; onReturn: () => void }>) {
  const [query, setQuery] = useState("");
  const visibleMemories = memories.filter((memory) =>
    `${memory.title} ${memory.summary}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <section className={styles["memory-surface"]} aria-labelledby="memory-title">
      <header className={styles["surface-heading"]}>
        <div>
          <span>MaxReps / Project menu / Memory</span>
          <h1 id="memory-title">Project Memory</h1>
          <p>
            Accepted knowledge, stale claims, and non-blocking proposals remain visibly distinct.
          </p>
        </div>
        <button type="button" className={styles["quiet-button"]} onClick={onReturn}>
          Return to Conversation
        </button>
      </header>
      <div className={styles["memory-workspace"]}>
        <aside>
          <label className={styles["search-field"]}>
            <MagnifyingGlassIcon size={15} aria-hidden="true" />
            <span className={styles["visually-hidden"]}>Search Project Memory</span>
            <input
              type="search"
              value={query}
              placeholder="Search Project Memory"
              onChange={(event) => setQuery(event.currentTarget.value)}
            />
          </label>
          <nav aria-label="Memory filters">
            <button type="button" data-active="true">
              All memory <span>3</span>
            </button>
            <button type="button">
              Accepted <span>1</span>
            </button>
            <button type="button">
              Stale <span>1</span>
            </button>
            <button type="button">
              Proposals <span>1</span>
            </button>
          </nav>
          <p>Memory Proposals stay here. They never create Attention by themselves.</p>
        </aside>
        <div className={styles["memory-list"]}>
          {visibleMemories.map((memory) => (
            <article
              key={memory.id}
              data-active={memory.id === activeMemoryId}
              data-status={memory.status}
            >
              <header>
                <span>{memory.status[0]?.toUpperCase() + memory.status.slice(1)}</span>
                <small>{memory.provenance}</small>
              </header>
              <h2>{memory.title}</h2>
              <p>{memory.summary}</p>
              <footer>
                <button type="button" className={styles["quiet-button"]}>
                  Inspect provenance
                </button>
                {memory.status === "proposal" ? (
                  <button type="button" className={styles["quiet-button"]}>
                    Review proposal
                  </button>
                ) : null}
                {memory.status === "stale" ? (
                  <button type="button" className={styles["quiet-button"]}>
                    Re-verify
                  </button>
                ) : null}
              </footer>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
