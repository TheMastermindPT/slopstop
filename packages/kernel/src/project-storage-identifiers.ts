import type { DomainIdentity } from "./workspace-identifiers.js";

export type StorageId = DomainIdentity<"StorageId">;
export type StorageGenerationId = DomainIdentity<"StorageGenerationId">;
export type CanonicalDatabaseLineageId = DomainIdentity<"CanonicalDatabaseLineageId">;
export type RuntimeDatabaseLineageId = DomainIdentity<"RuntimeDatabaseLineageId">;
export type ProjectStorageCreateRequestId = DomainIdentity<"ProjectStorageCreateRequestId">;
export type ProjectActivationId = DomainIdentity<"ProjectActivationId">;
export type CommandId = DomainIdentity<"CommandId">;

declare const writerGenerationBrand: unique symbol;
export type WriterGeneration = number & {
  readonly [writerGenerationBrand]: "WriterGeneration";
};

declare const projectSequenceBrand: unique symbol;
export type ProjectSequence = number & {
  readonly [projectSequenceBrand]: "ProjectSequence";
};

declare const canonicalEventOrdinalBrand: unique symbol;
export type CanonicalEventOrdinal = number & {
  readonly [canonicalEventOrdinalBrand]: "CanonicalEventOrdinal";
};

export function isWriterGeneration(value: number): value is WriterGeneration {
  return Number.isSafeInteger(value) && value > 0;
}

export function isProjectSequence(value: number): value is ProjectSequence {
  return Number.isSafeInteger(value) && value > 0;
}

export function isCanonicalEventOrdinal(value: number): value is CanonicalEventOrdinal {
  return Number.isSafeInteger(value) && value >= 0;
}
