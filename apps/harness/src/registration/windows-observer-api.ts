import * as koffi from "koffi";

type NativeCall = (...arguments_: readonly unknown[]) => unknown;

export function createWindowsObserverApi() {
  const library = koffi.load("kernel32.dll");
  const bind = (signature: string): NativeCall => library.func(signature);
  return {
    lastError: bind("uint32_t __stdcall GetLastError()"),
    close: bind("int __stdcall CloseHandle(void *handle)"),
    openProcess: bind("void * __stdcall OpenProcess(uint32_t access, int inherit, uint32_t pid)"),
    openJob: bind(
      "void * __stdcall OpenJobObjectW(uint32_t access, int inherit, const char16_t *name)",
    ),
    processSession: bind(
      "int __stdcall ProcessIdToSessionId(uint32_t pid, _Out_ uint32_t *session)",
    ),
    processSnapshot: bind(
      "void * __stdcall CreateToolhelp32Snapshot(uint32_t flags, uint32_t pid)",
    ),
    firstProcess: bind("int __stdcall Process32FirstW(void *snapshot, void *entry)"),
    nextProcess: bind("int __stdcall Process32NextW(void *snapshot, void *entry)"),
    createJob: bind("void * __stdcall CreateJobObjectW(void *security, const char16_t *name)"),
    setJob: bind(
      "int __stdcall SetInformationJobObject(void *job, int infoClass, void *info, uint32_t length)",
    ),
    queryJob: bind(
      "int __stdcall QueryInformationJobObject(void *job, int infoClass, void *info, uint32_t length, void *returnLength)",
    ),
    inJob: bind("int __stdcall IsProcessInJob(void *process, void *job, _Out_ int *result)"),
    terminateJob: bind("int __stdcall TerminateJobObject(void *job, uint32_t exitCode)"),
    initializeAttributes: bind(
      "int __stdcall InitializeProcThreadAttributeList(void *list, uint32_t count, uint32_t flags, _Inout_ size_t *size)",
    ),
    updateAttribute: bind(
      "int __stdcall UpdateProcThreadAttribute(void *list, uint32_t flags, size_t attribute, void *value, size_t size, void *previous, void *returnSize)",
    ),
    deleteAttributes: bind("void __stdcall DeleteProcThreadAttributeList(void *list)"),
    createProcess: bind(
      "int __stdcall CreateProcessW(const char16_t *app, void *commandLine, void *processSecurity, void *threadSecurity, int inherit, uint32_t flags, void *environment, const char16_t *cwd, void *startup, void *information)",
    ),
    resume: bind("uint32_t __stdcall ResumeThread(void *thread)"),
    wait: bind("uint32_t __stdcall WaitForSingleObject(void *handle, uint32_t milliseconds)"),
    processTimes: bind(
      "int __stdcall GetProcessTimes(void *process, void *creation, void *exit, void *kernel, void *user)",
    ),
    exitCode: bind("int __stdcall GetExitCodeProcess(void *process, _Out_ uint32_t *code)"),
    createPipe: bind(
      "int __stdcall CreatePipe(_Out_ void **reader, _Out_ void **writer, void *security, uint32_t size)",
    ),
    setHandle: bind(
      "int __stdcall SetHandleInformation(void *handle, uint32_t mask, uint32_t flags)",
    ),
    peekPipe: bind(
      "int __stdcall PeekNamedPipe(void *pipe, void *buffer, uint32_t size, void *read, _Out_ uint32_t *available, void *left)",
    ),
    readFile: bind(
      "int __stdcall ReadFile(void *file, void *buffer, uint32_t size, _Out_ uint32_t *read, void *overlapped)",
    ),
    createFile: bind(
      "void * __stdcall CreateFileW(const char16_t *path, uint32_t access, uint32_t share, void *security, uint32_t disposition, uint32_t flags, void *templateHandle)",
    ),
    windowsDirectory: bind(
      "uint32_t __stdcall GetWindowsDirectoryW(void *buffer, uint32_t capacity)",
    ),
  };
}

export type WindowsObserverApi = ReturnType<typeof createWindowsObserverApi>;

export class WindowsObserverApiError extends Error {
  constructor(readonly code: number) {
    super(`Windows observer API failed (${code}).`);
    this.name = "WindowsObserverApiError";
  }
}

export function nativeInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new Error("Invalid Windows integer result.");
  }
  return value;
}

export function requireWindowsSuccess(api: WindowsObserverApi, result: unknown): void {
  if (nativeInteger(result) === 0) {
    const code = nativeInteger(api.lastError());
    throw new WindowsObserverApiError(code);
  }
}

export function readWindowsBuffer(
  api: WindowsObserverApi,
  handle: bigint,
  capacity: number,
): Buffer {
  const buffer = Buffer.alloc(capacity);
  const received: unknown[] = [0];
  requireWindowsSuccess(api, api.readFile(handle, buffer, capacity, received, null));
  const count = nativeInteger(received[0]);
  if (count < 0 || count > capacity) throw new Error("Windows observer read length is invalid.");
  return buffer.subarray(0, count);
}

export class WindowsObserverResources {
  private readonly handles = new Set<bigint>();
  private readonly memory: unknown[] = [];
  private readonly attributes: unknown[] = [];

  constructor(readonly api: WindowsObserverApi) {}

  ownHandle(value: unknown): bigint {
    const code = nativeInteger(this.api.lastError());
    const address = koffi.address(value);
    if (address === 0n || address === 0xffffffffffffffffn) {
      throw new WindowsObserverApiError(code);
    }
    this.handles.add(address);
    return address;
  }

  closeHandle(handle: bigint): void {
    if (!this.handles.delete(handle)) throw new Error("Windows observer handle is not owned.");
    requireWindowsSuccess(this.api, this.api.close(handle));
  }

  allocate(type: string, length: number): unknown {
    const pointer: unknown = koffi.alloc(type, length);
    this.memory.push(pointer);
    return pointer;
  }

  ownAttributes(pointer: unknown): void {
    this.attributes.push(pointer);
  }

  close(): void {
    const failures: unknown[] = [];
    for (const handle of [...this.handles]) {
      try {
        this.closeHandle(handle);
      } catch (error) {
        failures.push(error);
      }
    }
    for (const pointer of this.attributes.splice(0)) this.api.deleteAttributes(pointer);
    for (const pointer of this.memory.splice(0)) koffi.free(pointer);
    if (failures.length > 0)
      throw new AggregateError(failures, "Windows observer handle closure failed.");
  }
}
