import * as Sentry from "@sentry/electron/main";

function basename(value: string | undefined): string | undefined {
  return value?.split(/[\\/]/).at(-1);
}

type SanitizableFrame = {
  abs_path?: unknown;
  context_line?: unknown;
  filename?: string;
  post_context?: unknown;
  pre_context?: unknown;
  vars?: unknown;
};

type SanitizableStacktrace = { frames?: SanitizableFrame[] };
type SanitizableException = { value?: string; stacktrace?: SanitizableStacktrace };
type SanitizableThread = { stacktrace?: SanitizableStacktrace };
type SanitizableDebugImage = { code_file?: string; debug_file?: string | null };

type SanitizableEvent = {
  breadcrumbs?: unknown;
  contexts?: unknown;
  debug_meta?: { images?: SanitizableDebugImage[] };
  exception?: { values?: SanitizableException[] };
  extra?: unknown;
  logentry?: unknown;
  message?: string;
  request?: unknown;
  server_name?: unknown;
  threads?: { values: SanitizableThread[] };
  user?: unknown;
};

function sanitizeFrame(frame: SanitizableFrame): void {
  delete frame.abs_path;
  const sanitizedFilename = basename(frame.filename);
  if (sanitizedFilename === undefined) {
    delete frame.filename;
  } else {
    frame.filename = sanitizedFilename;
  }
  delete frame.context_line;
  delete frame.post_context;
  delete frame.pre_context;
  delete frame.vars;
}

function sanitizeStacktrace(stacktrace: SanitizableStacktrace | undefined): void {
  for (const frame of stacktrace?.frames ?? []) sanitizeFrame(frame);
}

function sanitizeDebugImage(image: SanitizableDebugImage): void {
  if (image.code_file !== undefined) image.code_file = basename(image.code_file) ?? "";
  if (typeof image.debug_file === "string") {
    image.debug_file = basename(image.debug_file) ?? "";
  }
}

function sanitizeExceptions(exceptions: SanitizableException[] | undefined): void {
  for (const exception of exceptions ?? []) {
    if (exception.value !== undefined) exception.value = "Redacted exception message";
    sanitizeStacktrace(exception.stacktrace);
  }
}

function sanitizeThreads(threads: SanitizableThread[] | undefined): void {
  for (const thread of threads ?? []) sanitizeStacktrace(thread.stacktrace);
}

function sanitizeDebugImages(images: SanitizableDebugImage[] | undefined): void {
  for (const image of images ?? []) sanitizeDebugImage(image);
}

function sanitizeEvent<T extends SanitizableEvent>(event: T): T {
  delete event.breadcrumbs;
  delete event.contexts;
  delete event.extra;
  delete event.logentry;
  delete event.request;
  delete event.server_name;
  delete event.user;

  if (event.message !== undefined) event.message = "Redacted application error";
  sanitizeExceptions(event.exception?.values);
  sanitizeThreads(event.threads?.values);
  sanitizeDebugImages(event.debug_meta?.images);
  return event;
}

/** The Sentry DSN, only with explicit consent and a non-empty value. */
function consentedDsn(): string | undefined {
  if (process.env["SLOPSTOP_SENTRY_CONSENT"] !== "1") return undefined;
  const dsn = process.env["SLOPSTOP_SENTRY_DSN"];
  return dsn === undefined || dsn.length === 0 ? undefined : dsn;
}

export function initializeCrashReporting(): boolean {
  const dsn = consentedDsn();
  if (dsn === undefined) return false;

  Sentry.init({
    dsn,
    sendDefaultPii: false,
    // Native minidumps hold process memory and paths and bypass `beforeSend`, so none is sent.
    integrations: (defaults) =>
      defaults.filter((integration) => integration.name !== "SentryMinidump"),
    beforeSend: sanitizeEvent,
  });

  return true;
}

export function reportHarnessCrash(exitCode: number): void {
  Sentry.captureMessage("Harness utility process exited unexpectedly.", {
    level: "error",
    tags: { exitCode: String(exitCode) },
  });
}
