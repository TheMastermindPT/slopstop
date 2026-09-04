const initializationFailureMessage = "Project Storage application client initialization failed.";

export class ApplicationClientInitializationCloseError extends AggregateError {
  constructor(initializationFailure: unknown, closeFailure: unknown) {
    super([initializationFailure, closeFailure], initializationFailureMessage);
  }
}

export async function initializeRetainedApplicationClient<
  Client extends Readonly<{ close(): Promise<void> | void }>,
>(
  client: Client,
  retain: (client: Client | undefined) => void,
  initialize: (client: Client) => Promise<void>,
): Promise<Client> {
  retain(client);
  try {
    await initialize(client);
    return client;
  } catch (initializationFailure) {
    retain(undefined);
    try {
      await client.close();
    } catch (closeFailure) {
      throw new ApplicationClientInitializationCloseError(initializationFailure, closeFailure);
    }
    throw initializationFailure;
  }
}
