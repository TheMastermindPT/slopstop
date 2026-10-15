import type { ProjectConversationReadResult } from "@slopstop/protocol";
import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import type { ConversationMemoryStore } from "./conversation-memory.js";
import { canReload, type LoadFailure } from "./load-notice.js";
import { outcomeOnReturn } from "./save-outcome.js";

/** One shown message: what the stream lists. */
export type ShownMessage = Readonly<{ id: string; cursor: number; text: string; savedAt: string }>;

/** The activation the region loads and saves for, and whether it may write. */
export type ConversationActivation = Readonly<{
  projectId: ProjectConversationReadResult["request"]["projectId"];
  activationId: ProjectConversationReadResult["request"]["activationId"];
  readOnly: boolean;
}>;

/** Where the region's load stands; a failed load keeps its failure while Reload reads again. */
export type Load =
  | Readonly<{ kind: "loading" }>
  | Readonly<{ kind: "loaded" }>
  | Readonly<{ kind: "failed"; failure: LoadFailure; reloading: boolean }>;

type Read = Extract<ProjectConversationReadResult, { status: "read" }>;
type Loaded = Readonly<{ revision: number; messages: ShownMessage[] }>;

/** How long a load runs before the status slot says so. */
const loadingDelayMs = 300;

const shown = (read: Read): ShownMessage[] =>
  (read.conversation?.messages ?? []).map((message) => ({
    id: message.conversationMessageId,
    cursor: message.cursor,
    text: message.text,
    savedAt: message.savedAt,
  }));

/**
 * Reads every page, following `nextCursor` until it is `null`; never assumes a page size. A
 * failure on any page fails the whole load, so no partial list is ever shown.
 */
async function readAllPages(
  activation: Pick<ConversationActivation, "projectId" | "activationId">,
): Promise<Loaded | LoadFailure> {
  const messages: ShownMessage[] = [];
  let after: number | null = null;
  for (;;) {
    const result: ProjectConversationReadResult | LoadFailure = await window.slopstop
      .readConversation({
        projectId: activation.projectId,
        activationId: activation.activationId,
        after,
      })
      .catch((): LoadFailure => ({ status: "rejected-call" }));
    if (result.status !== "read") return result;
    messages.push(...shown(result));
    after = result.conversation?.nextCursor ?? null;
    if (after === null) return { revision: result.conversation?.revision ?? 0, messages };
  }
}

/** Focus may move only from the page itself or the control that started the load. */
function focusIsFree(startedFrom: Element | null): boolean {
  const focused = document.activeElement;
  return focused === null || focused === document.body || focused === startedFrom;
}

type Targets = Readonly<{
  composer: RefObject<HTMLTextAreaElement | null>;
  reloadButton: RefObject<HTMLButtonElement | null>;
  noticeTitle: RefObject<HTMLParagraphElement | null>;
}>;

/** After a focusing load: the composer on success, Reload on failure, the title with no action. */
function focusAfter(result: Loaded | LoadFailure, targets: Targets) {
  if (!("status" in result)) targets.composer.current?.focus();
  else if (canReload(result)) targets.reloadButton.current?.focus();
  else targets.noticeTitle.current?.focus();
}

/** A focusing load asks for focus; the effect gives it once the notice or composer is drawn. */
function useFocusRequest(targets: Targets) {
  const latest = useRef(targets);
  latest.current = targets;
  const [focusFor, setFocusFor] = useState<Loaded | LoadFailure | undefined>(undefined);
  useEffect(() => {
    if (focusFor === undefined) return;
    focusAfter(focusFor, latest.current);
    setFocusFor(undefined);
  }, [focusFor]);
  return setFocusFor;
}

/**
 * On mount and on each new activation: decide what the kept outcome still shows (G27), read every
 * page, and give focus only for the activation's first load, from the page or the starting control.
 */
function useLoadOnActivation(
  input: Readonly<{
    store: ConversationMemoryStore;
    projectId: ConversationActivation["projectId"];
    activationId: ConversationActivation["activationId"];
    read(): Promise<Loaded | LoadFailure>;
    firstLoad: { current: boolean };
    requestFocus(result: Loaded | LoadFailure): void;
  }>,
) {
  const { store, projectId, activationId, read, firstLoad, requestFocus } = input;
  useEffect(() => {
    let alive = true;
    const startedFrom = document.activeElement;
    const returning = firstLoad.current;
    store.update(projectId, (current) => ({
      ...current,
      activationId,
      outcome: returning ? outcomeOnReturn(current.outcome) : current.outcome,
    }));
    void read().then((result) => {
      if (!alive) return;
      if (firstLoad.current && focusIsFree(startedFrom)) requestFocus(result);
      firstLoad.current = false;
    });
    return () => {
      alive = false;
    };
  }, [store, projectId, activationId, read, firstLoad, requestFocus]);
}

/**
 * Loads every page on mount and on each new activation, and again on Reload. Focus moves only for
 * the first load of an activation or a Reload, and only from the page or the control that started
 * it (G26).
 */
export function useConversationLoad(
  scope: Readonly<{ store: ConversationMemoryStore; activation: ConversationActivation }> & Targets,
) {
  const { store, activation } = scope;
  const { projectId, activationId } = activation;
  const [messages, setMessages] = useState<ShownMessage[]>([]);
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [loadingShown, setLoadingShown] = useState(false);
  const firstLoad = useRef(store.get(projectId).activationId !== activationId);
  const requestFocus = useFocusRequest(scope);

  const read = useCallback(async () => {
    const timer = setTimeout(() => setLoadingShown(true), loadingDelayMs);
    const result = await readAllPages({ projectId, activationId });
    clearTimeout(timer);
    setLoadingShown(false);
    if ("status" in result) {
      setMessages([]);
      setLoad({ kind: "failed", failure: result, reloading: false });
      return result;
    }
    store.update(projectId, (current) => ({ ...current, expectedRevision: result.revision }));
    setMessages(result.messages);
    setLoad({ kind: "loaded" });
    return result;
  }, [store, projectId, activationId]);

  useLoadOnActivation({ store, projectId, activationId, read, firstLoad, requestFocus });

  const retry = async () => {
    if (load.kind !== "failed" || load.reloading) return;
    const startedFrom = document.activeElement;
    setLoad({ ...load, reloading: true });
    const result = await read();
    if (focusIsFree(startedFrom)) requestFocus(result);
  };

  /** A read again after a replay or a conflict: it never moves focus. */
  const refresh = () => {
    setLoad({ kind: "loading" });
    return read();
  };

  return { messages, setMessages, load, loadingShown, retry, refresh };
}
