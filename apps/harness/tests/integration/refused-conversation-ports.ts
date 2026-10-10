/** Conversation ports for fake repositories that never expect Conversation work. */
export const refusedConversationPorts = {
  conversationTransaction: async (): Promise<never> => {
    throw new Error("Unexpected Conversation work.");
  },
  conversationRead: async (): Promise<never> => {
    throw new Error("Unexpected Conversation work.");
  },
  hasUnfinishedClient: false,
  abandonClient: async (): Promise<never> => {
    throw new Error("Unexpected client abandonment.");
  },
} as const;
