import {
  CanonicalProjectActivationResultSchema,
  decodeStrict,
  type ProjectConversationReadRequest,
  type ProjectConversationReadResult,
  ProjectConversationReadResultSchema,
  type ProjectConversationSaveRequest,
  type ProjectConversationSaveResult,
  ProjectConversationSaveResultSchema,
  ProjectListResultSchema,
  RepositoryChoiceResultSchema,
} from "@slopstop/protocol";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import type { SlopStopApi } from "../../shared/desktop-api.js";
import { App } from "../app.js";
import { exposeApi, readyApi } from "../test-api.js";

export const projectA = "11111111-1111-4111-8111-111111111111";
export const projectB = "22222222-2222-4222-8222-222222222222";
export const note = "No model is connected yet. Messages are saved on this computer.";

/** A promise the test settles by hand, so a read or a save can stay pending. */
export function gate<T>() {
  let open: (value: T) => void = () => undefined;
  let fail: (error: Error) => void = () => undefined;
  // Effect waiver EW9: renderer test support that lives in src.
  // @effect-diagnostics-next-line newPromise:off
  const promise = new Promise<T>((resolve, reject) => {
    open = resolve;
    fail = reject;
  });
  return { promise, open, fail };
}

const listed = decodeStrict(ProjectListResultSchema, {
  status: "listed",
  projects: [projectA, projectB].map((projectId, index) => ({
    registration: "registered",
    projectId,
    name: index === 0 ? "repo-a" : "repo-b",
    repositoryBindingId: projectId,
    workspaceId: projectId,
    access: "not-assessed",
    repositoryLocation: { status: "present" },
    storage: { status: "healthy", storageId: projectId, generationId: projectId },
  })),
  hiddenCount: 0,
});

let activations = 0;
/** A read-write activation echoing the request, with a fresh activation id each time. */
function readWrite(request: { projectId: string }) {
  activations += 1;
  return decodeStrict(CanonicalProjectActivationResultSchema, {
    status: "active",
    request,
    access: "read-write",
    activationId: `aaaaaaaa-aaaa-4aaa-8aaa-${String(activations).padStart(12, "0")}`,
    writerGeneration: 1,
  });
}

/** A read answer with these messages (cursor = index + 1) and this revision. */
export function readAnswer(
  request: ProjectConversationReadRequest,
  options: Readonly<{
    texts?: string[];
    revision?: number;
    first?: number;
    nextCursor?: number | null;
  }> = {},
): ProjectConversationReadResult {
  const texts = options.texts ?? [];
  if (texts.length === 0 && options.revision === undefined)
    return { status: "read", request, conversation: null };
  const first = options.first ?? 1;
  return decodeStrict(ProjectConversationReadResultSchema, {
    status: "read",
    request,
    conversation: {
      conversationId: "33333333-3333-4333-8333-333333333333",
      branchId: "44444444-4444-4444-8444-444444444444",
      revision: options.revision ?? texts.length,
      messages: texts.map((text, index) => ({
        conversationMessageId: `55555555-5555-4555-8555-${String(first + index).padStart(12, "0")}`,
        cursor: first + index,
        author: "user",
        text,
        savedAt: "2026-10-11T12:00:00.000Z",
      })),
      nextCursor: options.nextCursor ?? null,
    },
  });
}

/** A non-replayed `saved` answer for a save request. */
export function savedAnswer(
  request: ProjectConversationSaveRequest,
  revision: number,
  replayed = false,
): ProjectConversationSaveResult {
  return decodeStrict(ProjectConversationSaveResultSchema, {
    status: "saved",
    request,
    conversationMessageId: "66666666-6666-4666-8666-000000000001",
    cursor: revision,
    revision,
    savedAt: "2026-10-11T12:00:00.000Z",
    replayed,
  });
}

type Handlers = Readonly<{
  read?: (request: ProjectConversationReadRequest) => Promise<ProjectConversationReadResult>;
  save?: (request: ProjectConversationSaveRequest) => Promise<ProjectConversationSaveResult>;
  activate?: (request: { projectId: string }) => Promise<unknown>;
  subscribeHarnessStatus?: SlopStopApi["subscribeHarnessStatus"];
}>;

/** Renders the app with two registered Projects and scripted conversation calls. */
export function renderWindow(
  handlers: Handlers,
  setup: Parameters<typeof userEvent.setup>[0] = {},
) {
  const read = vi.fn(handlers.read ?? (async (request) => readAnswer(request)));
  const save = vi.fn(
    handlers.save ??
      (async () => {
        throw new Error("save not scripted");
      }),
  );
  exposeApi(
    readyApi({
      listProjects: async () => listed,
      activateProject: async (request) =>
        decodeStrict(
          CanonicalProjectActivationResultSchema,
          handlers.activate ? await handlers.activate(request) : readWrite(request),
        ),
      switchProject: async (request) => ({
        status: "target-result",
        request,
        sourceReleased: true,
        target: decodeStrict(
          CanonicalProjectActivationResultSchema,
          handlers.activate ? await handlers.activate(request.to) : readWrite(request.to),
        ),
      }),
      readConversation: read,
      saveConversationMessage: save,
      ...(handlers.subscribeHarnessStatus === undefined
        ? {}
        : { subscribeHarnessStatus: handlers.subscribeHarnessStatus }),
      // A chosen folder opens the add flow's first step, which Esc cancels.
      chooseRepository: async () =>
        decodeStrict(RepositoryChoiceResultSchema, {
          status: "repository-selected",
          repositorySelectionId: "77777777-7777-4777-8777-777777777777",
          directory: "C:\\work\\repository",
        }),
    }),
  );
  render(<App />);
  return { read, save, user: userEvent.setup(setup) };
}

/** Opens a Project by its list button and returns the region's controls. */
export async function openProject(
  user: ReturnType<typeof userEvent.setup>,
  name: "repo-a" | "repo-b" = "repo-a",
) {
  await user.click(await screen.findByRole("button", { name: `Open Project ${name}` }));
  return controls();
}

/** The Conversation controls, by the speech table's names. */
export function controls() {
  const region = within(screen.getByRole("region", { name: "Project workspace" }));
  return {
    region,
    composer: () => region.getByRole("textbox", { name: "Message" }),
    save: () => region.getByRole("button", { name: /^(Save locally|Saving…)$/ }),
    status: () => {
      const slot = document.getElementById("conversation-status");
      if (slot === null) throw new Error("No status slot");
      return slot;
    },
    messages: () => region.queryAllByRole("listitem").map((item) => item.textContent ?? ""),
  };
}
