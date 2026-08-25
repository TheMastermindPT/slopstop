import {
  CaretDownIcon,
  ChatCircleDotsIcon,
  CheckCircleIcon,
  GraphIcon,
  MagnifyingGlassIcon,
  PaperclipIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useState } from "react";
import styles from "./prototype-app.module.css";
import {
  type ConversationBranchFixture,
  type ConversationMessageFixture,
  contextItems,
  conversationBranches,
} from "./prototype-fixtures.js";
import { type ContextRecordView, fileById, type Selection } from "./prototype-model.js";

function ConversationNavigator({
  activeBranchId,
  onClose,
  onSelect,
}: Readonly<{
  activeBranchId: string;
  onClose: () => void;
  onSelect: (branch: ConversationBranchFixture) => void;
}>) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const visibleBranches = conversationBranches.filter(
    (branch) =>
      normalizedQuery.length === 0 || branch.pathLabel.toLowerCase().includes(normalizedQuery),
  );

  return (
    <div
      className={styles["conversation-navigator"]}
      role="dialog"
      aria-modal="false"
      aria-labelledby="conversation-navigator-title"
    >
      <header>
        <div>
          <strong id="conversation-navigator-title">Conversation navigator</strong>
          <span>Project and Waypoint branches stay separate.</span>
        </div>
        <button type="button" aria-label="Close conversation navigator" onClick={onClose}>
          <XIcon size={16} />
        </button>
      </header>
      <label className={styles["navigator-search"]}>
        <MagnifyingGlassIcon size={15} aria-hidden="true" />
        <span className={styles["visually-hidden"]}>Search conversations</span>
        <input
          type="search"
          value={query}
          placeholder="Search conversations and branches"
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
      </label>
      <div className={styles["branch-list"]}>
        {visibleBranches.map((branch) => (
          <button
            key={branch.id}
            type="button"
            data-active={branch.id === activeBranchId}
            data-depth={branch.depth}
            aria-label={branch.pathLabel}
            onClick={() => onSelect(branch)}
          >
            <span>{branch.label}</span>
            <small>
              {branch.scopeId === "project" ? "Project conversation" : "Waypoint scope"}
            </small>
          </button>
        ))}
      </div>
    </div>
  );
}

function BranchInfluenceDialog({
  includedIds,
  onApply,
  onClose,
}: Readonly<{
  includedIds: readonly string[];
  onApply: (ids: readonly string[]) => void;
  onClose: () => void;
}>) {
  const [pendingIds, setPendingIds] = useState<readonly string[]>(includedIds);

  function toggleItem(id: string, checked: boolean): void {
    setPendingIds((current) =>
      checked ? [...current, id] : current.filter((candidate) => candidate !== id),
    );
  }

  return (
    <div
      className={styles["influence-dialog"]}
      role="dialog"
      aria-modal="false"
      aria-labelledby="branch-influence-title"
    >
      <header>
        <div>
          <strong id="branch-influence-title">Review branch influence</strong>
          <span>Choose what may shape the next response. Nothing is merged.</span>
        </div>
        <button type="button" aria-label="Close branch influence" onClick={onClose}>
          <XIcon size={16} />
        </button>
      </header>
      <div className={styles["influence-list"]}>
        {contextItems.map((item) => (
          <label key={item.id}>
            <input
              type="checkbox"
              checked={pendingIds.includes(item.id)}
              aria-label={`Include ${item.label.toLowerCase()}`}
              onChange={(event) => toggleItem(item.id, event.currentTarget.checked)}
            />
            <span>
              <strong>{item.label}</strong>
              <small>{item.detail}</small>
            </span>
          </label>
        ))}
      </div>
      <footer>
        <span>{pendingIds.length} included in this proposal</span>
        <button
          type="button"
          className={styles["primary-button"]}
          onClick={() => onApply(pendingIds)}
        >
          Use this selection
        </button>
      </footer>
    </div>
  );
}

function DecisionCanvas() {
  return (
    <aside className={styles["decision-canvas"]} aria-label="Decision Canvas">
      <header>
        <div>
          <strong>Decision Canvas</strong>
          <span>Revision 03 · live</span>
        </div>
        <span className={styles["decision-count"]}>3 / 5 accepted</span>
      </header>
      <section>
        <span>Accepted</span>
        <p>Wall time is the durable clock.</p>
        <p>Refresh and suspension stay separate proofs.</p>
        <p>Broken recovery never reports clean.</p>
      </section>
      <section data-state="proposed">
        <span>Proposed</span>
        <p>Restore the exact active interval.</p>
        <p>Record recovery evidence by revision.</p>
      </section>
      <footer>
        <CheckCircleIcon size={16} />
        <span>
          <strong>Checkpoint ready</strong>
          <small>Continuity behaviour is coherent enough to review.</small>
        </span>
      </footer>
    </aside>
  );
}

function ConversationFeed({
  branch,
  messages,
  onToggleRecord,
}: Readonly<{
  branch: ConversationBranchFixture;
  messages: readonly ConversationMessageFixture[];
  onToggleRecord: () => void;
}>) {
  return (
    <>
      <div className={styles["thread-header"]}>
        <div>
          <strong>{branch.label}</strong>
          <span>{branch.scopeId === "project" ? "Project scope" : "Waypoint scope"}</span>
        </div>
        <span>{messages.length} messages · branch history preserved</span>
      </div>
      <div className={styles["feed"]} aria-live="polite">
        {messages.length === 0 ? (
          <div className={styles["branch-empty"]}>
            <GraphIcon size={20} />
            <strong>This branch starts from an exact earlier message.</strong>
            <p>Its content stays isolated until you approve what may influence a revision.</p>
          </div>
        ) : null}
        {messages.map((message) => (
          <article key={message.id} data-kind={message.kind}>
            <header>
              <strong>{message.author}</strong>
              <span>{branch.label}</span>
              <time>{message.time}</time>
            </header>
            <p>{message.body}</p>
            {message.contextRecordId === undefined ? null : (
              <button type="button" className={styles["record-link"]} onClick={onToggleRecord}>
                <CheckCircleIcon size={14} /> Inspect context record
              </button>
            )}
          </article>
        ))}
      </div>
    </>
  );
}

function ContextRecord({
  onClose,
  onOpenMemory,
  record,
}: Readonly<{
  onClose: () => void;
  onOpenMemory: (memoryId: string) => void;
  record: ContextRecordView;
}>) {
  return (
    <section className={styles["context-record"]} aria-label="Context record">
      <header>
        <div>
          <strong>Context record</strong>
          <span>{record.id} · complete · immutable</span>
        </div>
        <button type="button" aria-label="Close context record" onClick={onClose}>
          <XIcon size={15} />
        </button>
      </header>
      <div>
        <section>
          <strong>Included exactly</strong>
          {contextItems
            .filter((item) => record.includedIds.includes(item.id))
            .map((item) => (
              <span key={item.id}>{item.label}</span>
            ))}
        </section>
        <section>
          <strong>Excluded exactly</strong>
          {contextItems
            .filter((item) => record.excludedIds.includes(item.id))
            .map((item) => (
              <span key={item.id}>{item.label}</span>
            ))}
        </section>
      </div>
      <button
        type="button"
        className={styles["memory-link"]}
        onClick={() => onOpenMemory("recovery-contract")}
      >
        Open Memory · Rest-session recovery contract
      </button>
    </section>
  );
}

function ContextProposal({
  includedIds,
  onReview,
}: Readonly<{ includedIds: readonly string[]; onReview: () => void }>) {
  const includedItems = contextItems.filter((item) => includedIds.includes(item.id));
  const excludedItems = contextItems.filter((item) => !includedIds.includes(item.id));
  return (
    <section className={styles["context-proposal"]} aria-label="Context proposal">
      <header>
        <div>
          <strong>Context proposal</strong>
          <span>
            {includedItems.length} included · {excludedItems.length} excluded
          </span>
        </div>
        <button type="button" className={styles["quiet-button"]} onClick={onReview}>
          Review branch influence
        </button>
      </header>
      <div className={styles["context-strips"]}>
        {includedItems.map((item) => (
          <span key={item.id} data-source={item.source}>
            {item.label}
          </span>
        ))}
      </div>
      <p>Excluded: {excludedItems.map((item) => item.label).join(" · ") || "Nothing"}</p>
    </section>
  );
}

function Composer({
  attachments,
  currentFileName,
  contextIncludedIds,
  onAddAttachment,
  onOpenInfluence,
  onSend,
}: Readonly<{
  attachments: readonly string[];
  currentFileName: string | undefined;
  contextIncludedIds: readonly string[];
  onAddAttachment: () => void;
  onOpenInfluence: () => void;
  onSend: (body: string) => void;
}>) {
  const [draft, setDraft] = useState("");

  function submit(): void {
    const body = draft.trim();
    if (body.length === 0) {
      return;
    }
    onSend(body);
    setDraft("");
  }

  return (
    <div className={styles["composer"]}>
      <ContextProposal includedIds={contextIncludedIds} onReview={onOpenInfluence} />
      {attachments.length === 0 ? null : (
        <div className={styles["attachments"]}>
          {attachments.map((attachment) => (
            <span key={attachment}>
              <PaperclipIcon size={13} /> Attached: {attachment}
            </span>
          ))}
        </div>
      )}
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.currentTarget.value)}
        placeholder="Correct the end-state, test an expectation, or ask for a proposal…"
        aria-label="Message"
        rows={3}
      />
      <div className={styles["composer-actions"]}>
        <button
          type="button"
          className={styles["quiet-button"]}
          disabled={currentFileName === undefined || attachments.includes(currentFileName)}
          onClick={onAddAttachment}
          aria-label="Attach current file"
        >
          <PaperclipIcon size={16} /> Attach current file
        </button>
        <span>Scope expansion and source require confirmation.</span>
        <button type="button" className={styles["send-button"]} onClick={submit}>
          Send to model
        </button>
      </div>
    </div>
  );
}

function selectedFileName(selection: Selection): string | undefined {
  return selection.kind === "file" ? fileById(selection.id)?.name : undefined;
}

function messagesForBranch(
  feed: readonly ConversationMessageFixture[],
  branchId: string,
): readonly ConversationMessageFixture[] {
  return feed.filter((message) => message.branchId === branchId);
}

function ConversationHeading({
  branch,
  navigatorOpen,
  onOpenReview,
  onSelectBranch,
  onToggleNavigator,
}: Readonly<{
  branch: ConversationBranchFixture;
  navigatorOpen: boolean;
  onOpenReview: () => void;
  onSelectBranch: (branch: ConversationBranchFixture) => void;
  onToggleNavigator: () => void;
}>) {
  return (
    <header className={styles["conversation-heading"]}>
      <div className={styles["conversation-heading-copy"]}>
        <button
          type="button"
          className={styles["scope-breadcrumb"]}
          aria-label="Open conversation navigator"
          aria-expanded={navigatorOpen}
          onClick={onToggleNavigator}
        >
          <ChatCircleDotsIcon size={16} />
          <span>{branch.pathLabel}</span>
          <CaretDownIcon size={14} />
        </button>
        <h1 id="conversation-title">Frame the product</h1>
        <p>
          Agree on the end-state first. The Decision Canvas follows the conversation without
          changing the canonical map.
        </p>
      </div>
      <div className={styles["surface-actions"]}>
        <span className={styles["provisional-mark"]}>Provisional · no Project state changed</span>
        <button type="button" className={styles["primary-button"]} onClick={onOpenReview}>
          Review Frame
        </button>
      </div>
      {navigatorOpen ? (
        <ConversationNavigator
          activeBranchId={branch.id}
          onClose={onToggleNavigator}
          onSelect={onSelectBranch}
        />
      ) : null}
    </header>
  );
}

export function ConversationSurface({
  attachments,
  branch,
  contextIncludedIds,
  feed,
  latestRecord,
  onAddAttachment,
  onBranch,
  onContextSelection,
  onOpenMemory,
  onOpenReview,
  onSend,
  selection,
}: Readonly<{
  attachments: readonly string[];
  branch: ConversationBranchFixture;
  contextIncludedIds: readonly string[];
  feed: readonly ConversationMessageFixture[];
  latestRecord: ContextRecordView | undefined;
  onAddAttachment: () => void;
  onBranch: (branch: ConversationBranchFixture) => void;
  onContextSelection: (ids: readonly string[]) => void;
  onOpenMemory: (memoryId: string) => void;
  onOpenReview: () => void;
  onSend: (body: string) => void;
  selection: Selection;
}>) {
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [influenceOpen, setInfluenceOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const currentFileName = selectedFileName(selection);
  const visibleMessages = messagesForBranch(feed, branch.id);

  return (
    <section className={styles["conversation-surface"]} aria-labelledby="conversation-title">
      <ConversationHeading
        branch={branch}
        navigatorOpen={navigatorOpen}
        onOpenReview={onOpenReview}
        onSelectBranch={(nextBranch) => {
          onBranch(nextBranch);
          setNavigatorOpen(false);
        }}
        onToggleNavigator={() => setNavigatorOpen((current) => !current)}
      />
      <div className={styles["conversation"]}>
        <DecisionCanvas />
        <div className={styles["conversation-thread"]}>
          <ConversationFeed
            branch={branch}
            messages={visibleMessages}
            onToggleRecord={() => setRecordOpen((current) => !current)}
          />
          {recordOpen && latestRecord !== undefined ? (
            <ContextRecord
              record={latestRecord}
              onClose={() => setRecordOpen(false)}
              onOpenMemory={onOpenMemory}
            />
          ) : null}
        </div>
        <Composer
          attachments={attachments}
          currentFileName={currentFileName}
          contextIncludedIds={contextIncludedIds}
          onAddAttachment={onAddAttachment}
          onOpenInfluence={() => setInfluenceOpen(true)}
          onSend={onSend}
        />
      </div>
      {influenceOpen ? (
        <BranchInfluenceDialog
          includedIds={contextIncludedIds}
          onClose={() => setInfluenceOpen(false)}
          onApply={(ids) => {
            onContextSelection(ids);
            setInfluenceOpen(false);
          }}
        />
      ) : null}
    </section>
  );
}
