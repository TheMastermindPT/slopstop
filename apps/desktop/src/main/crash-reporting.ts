import * as Sentry from "@sentry/electron/main";

function basename(value: string | undefined): string | undefined {
  return value?.split(/[\\/]/).at(-1);
}

export function initializeCrashReporting(): boolean {
  const dsn = process.env["SLOPSTOP_SENTRY_DSN"];
  const hasConsent = process.env["SLOPSTOP_SENTRY_CONSENT"] === "1";

  if (!hasConsent || dsn === undefined || dsn.length === 0) {
    return false;
  }

  Sentry.init({
    dsn,
    sendDefaultPii: false,
    beforeSend(event) {
      delete event.breadcrumbs;
      delete event.contexts;
      delete event.extra;
      delete event.logentry;
      delete event.request;
      delete event.server_name;
      delete event.user;

      if (event.message !== undefined) {
        event.message = "Redacted application error";
      }

      for (const exception of event.exception?.values ?? []) {
        if (exception.value !== undefined) {
          exception.value = "Redacted exception message";
        }
        for (const frame of exception.stacktrace?.frames ?? []) {
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
      }

      return event;
    },
  });

  return true;
}

export function reportHarnessCrash(exitCode: number): void {
  Sentry.captureMessage("Harness utility process exited unexpectedly.", {
    level: "error",
    tags: { exitCode: String(exitCode) },
  });
}
