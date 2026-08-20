import type { SlopStopApi } from "../shared/desktop-api.js";

declare global {
  interface Window {
    readonly slopstop: SlopStopApi;
  }
}
