import { HarnessStatusSchema, RetryHarnessResultSchema } from "@slopstop/protocol";
import { contextBridge, type IpcRendererEvent, ipcRenderer } from "electron";
import { desktopIpcChannels, type SlopStopApi } from "../shared/desktop-api.js";

const api: SlopStopApi = {
  getHarnessStatus: async () => {
    return HarnessStatusSchema.parse(await ipcRenderer.invoke(desktopIpcChannels.getHarnessStatus));
  },
  retryHarness: async () => {
    return RetryHarnessResultSchema.parse(
      await ipcRenderer.invoke(desktopIpcChannels.retryHarness),
    );
  },
  subscribeHarnessStatus: (listener) => {
    const receive = (_event: IpcRendererEvent, value: unknown) => {
      listener(HarnessStatusSchema.parse(value));
    };
    ipcRenderer.on(desktopIpcChannels.harnessStatusChanged, receive);
    return () => {
      ipcRenderer.off(desktopIpcChannels.harnessStatusChanged, receive);
    };
  },
};

contextBridge.exposeInMainWorld("slopstop", api);
