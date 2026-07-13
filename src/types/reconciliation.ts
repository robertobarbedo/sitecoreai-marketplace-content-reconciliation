/**
 * Types for the reconciliation data stored as a single JSON blob in the
 * `Value` field of the `Data` item under
 * /sitecore/system/Modules/Marketplace/ContentReconciliation in the base
 * environment.
 */

export interface EnvironmentRef {
  tenantId: string;
  tenantName: string;
  tenantDisplayName?: string;
}

/** A live environment resolved from application.context. */
export interface EnvironmentInfo extends EnvironmentRef {
  /** sitecoreContextId (context.preview) for authoring GraphQL calls. */
  contextId: string;
}

export interface TrackedField {
  /** Field-definition item id — also used for the sharedness lookup. */
  fieldId: string;
  name: string;
  /** Lazily determined when the field is first tracked, then cached. */
  shared: boolean;
  /** name.startsWith("__") — restores tab placement without re-querying. */
  isSystem: boolean;
  /**
   * Desired values. Outer key: tenantName; inner key: language name, or
   * SHARED_VALUE_KEY ("*") when shared === true. A missing inner key means
   * "no desired value" (Apply skips it); an empty string means "clear the
   * field".
   */
  values: Record<string, Record<string, string>>;
}

export interface TrackedItem {
  /** Item GUID as returned by GraphQL — stable across environments. */
  itemId: string;
  /** Base-environment path at track time (display only). */
  path: string;
  name: string;
  fields: TrackedField[];
}

export interface ReconciliationData {
  version: 1;
  /** ISO timestamp of the last save — optimistic-concurrency check. */
  updatedAt: string;
  baseEnvironment: EnvironmentRef;
  /** Snapshot of known environments at last save (rename resolution). */
  environments: EnvironmentRef[];
  items: TrackedItem[];
}

/** JSON stored in the Value field of the Base/Secondary marker items. */
export interface MarkerData {
  tenantId: string;
  tenantName: string;
  createdAt: string;
}

export function emptyReconciliationData(
  baseEnvironment: EnvironmentRef,
  environments: EnvironmentRef[],
): ReconciliationData {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    baseEnvironment,
    environments,
    items: [],
  };
}
