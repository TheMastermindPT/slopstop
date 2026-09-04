export class SerialLock {
  #tail: Promise<void> = Promise.resolve();

  async run<Result>(operation: () => Promise<Result>): Promise<Result> {
    const previous = this.#tail;
    let release: () => void = () => undefined;
    this.#tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  runAfterPending(operation: () => Promise<void>): Promise<void> {
    return this.run(operation);
  }
}
