/**
 * The availability texts every Project result shares: activation, switch and upgrade answers
 * read them here, so their producers cannot drift apart.
 */
export const projectAvailabilityMessages = {
  storageUnavailable: "Project Storage is unavailable.",
  coordinatorUnavailable: "Canonical Project coordination is unavailable.",
  connectionLost: "The Project connection is unavailable.",
} as const;
