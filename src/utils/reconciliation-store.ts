import type { ClientSDK } from "@sitecore-marketplace-sdk/client";
import {
  queryItemByPath,
  createItem,
  updateItemField,
  updateItemFieldByPath,
  deleteItem,
  type SitecoreItem,
} from "./sitecore-graphql";
import {
  SITECORE_TEMPLATES,
  MODULES_PARENT_ID,
  STORAGE_PATHS,
  MARKETPLACE_FOLDER_NAME,
  MODULE_FOLDER_NAME,
  BASE_MARKER_NAME,
  SECONDARY_MARKER_NAME,
  DATA_ITEM_NAME,
  DEFAULT_LANGUAGE,
} from "@/src/constants";
import {
  emptyReconciliationData,
  type EnvironmentInfo,
  type MarkerData,
  type ReconciliationData,
} from "@/src/types/reconciliation";

function readValueField(item: SitecoreItem | null): string | null {
  const valueField = item?.fields?.nodes?.find((f) => f.name === "Value");
  return valueField?.value || null;
}

function parseMarker(item: SitecoreItem | null): MarkerData | null {
  const raw = readValueField(item);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MarkerData;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

export interface DetectionResult {
  /** Environments holding a Base marker (normally 0 or 1). */
  baseCandidates: { env: EnvironmentInfo; marker: MarkerData | null }[];
  /** Environments holding a Secondary marker. */
  secondaries: EnvironmentInfo[];
  /** Environments whose detection queries failed. */
  unreachable: { env: EnvironmentInfo; error: string }[];
}

/**
 * Queries every environment for the Base/Secondary marker items to figure
 * out which environment (if any) owns the reconciliation data.
 */
export async function detectBaseEnvironment(
  client: ClientSDK,
  environments: EnvironmentInfo[],
): Promise<DetectionResult> {
  const result: DetectionResult = {
    baseCandidates: [],
    secondaries: [],
    unreachable: [],
  };

  await Promise.all(
    environments.map(async (env) => {
      try {
        const [baseItem, secondaryItem] = await Promise.all([
          queryItemByPath(client, env.contextId, STORAGE_PATHS.BASE_MARKER),
          queryItemByPath(
            client,
            env.contextId,
            STORAGE_PATHS.SECONDARY_MARKER,
          ),
        ]);
        if (baseItem) {
          result.baseCandidates.push({ env, marker: parseMarker(baseItem) });
        }
        if (secondaryItem) {
          result.secondaries.push(env);
        }
      } catch (error) {
        result.unreachable.push({
          env,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }),
  );

  return result;
}

// ---------------------------------------------------------------------------
// Data load / save
// ---------------------------------------------------------------------------

export type DataLoadResult =
  | { ok: true; data: ReconciliationData }
  | { ok: false; raw: string };

function mergeWithDefaults(
  parsed: Partial<ReconciliationData>,
  fallback: ReconciliationData,
): ReconciliationData {
  return {
    ...fallback,
    ...parsed,
    version: 1,
    baseEnvironment: parsed.baseEnvironment ?? fallback.baseEnvironment,
    environments: Array.isArray(parsed.environments)
      ? parsed.environments
      : fallback.environments,
    items: Array.isArray(parsed.items) ? parsed.items : [],
  };
}

/**
 * Loads the Data blob from the base environment. A missing Data item (or
 * empty Value) yields an empty dataset — it is created on first save. An
 * unparsable blob is returned raw so the UI can offer recovery without ever
 * auto-overwriting it.
 */
export async function loadData(
  client: ClientSDK,
  baseEnv: EnvironmentInfo,
  allEnvironments: EnvironmentInfo[],
): Promise<DataLoadResult> {
  const dataItem = await queryItemByPath(
    client,
    baseEnv.contextId,
    STORAGE_PATHS.DATA_ITEM,
  );
  const raw = readValueField(dataItem);
  const fallback = emptyReconciliationData(
    { ...baseEnv },
    allEnvironments.map((e) => ({
      tenantId: e.tenantId,
      tenantName: e.tenantName,
      tenantDisplayName: e.tenantDisplayName,
    })),
  );
  if (!raw) {
    return { ok: true, data: fallback };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<ReconciliationData>;
    return { ok: true, data: mergeWithDefaults(parsed, fallback) };
  } catch {
    return { ok: false, raw };
  }
}

/** Ensures a folder item exists, creating it under `parentId` if missing. */
async function ensureFolder(
  client: ClientSDK,
  sitecoreContextId: string,
  path: string,
  parentId: string,
  name: string,
): Promise<SitecoreItem> {
  const existing = await queryItemByPath(client, sitecoreContextId, path);
  if (existing) return existing;

  const created = await createItem(
    client,
    sitecoreContextId,
    parentId,
    SITECORE_TEMPLATES.MODULE_FOLDER,
    name,
  );
  if (!created) {
    throw new Error(`Failed to create ${name} folder`);
  }
  return created;
}

/** Ensures .../Modules/Marketplace/ContentReconciliation exists; returns it. */
async function ensureModuleFolder(
  client: ClientSDK,
  sitecoreContextId: string,
): Promise<SitecoreItem> {
  const marketplaceFolder = await ensureFolder(
    client,
    sitecoreContextId,
    STORAGE_PATHS.MARKETPLACE_FOLDER,
    MODULES_PARENT_ID,
    MARKETPLACE_FOLDER_NAME,
  );
  return ensureFolder(
    client,
    sitecoreContextId,
    STORAGE_PATHS.MODULE_FOLDER,
    marketplaceFolder.itemId,
    MODULE_FOLDER_NAME,
  );
}

/** Query-or-create a settings-template item under the module folder. */
async function ensureSettingsItem(
  client: ClientSDK,
  sitecoreContextId: string,
  moduleFolderId: string,
  path: string,
  name: string,
): Promise<SitecoreItem> {
  const existing = await queryItemByPath(client, sitecoreContextId, path);
  if (existing) return existing;

  const created = await createItem(
    client,
    sitecoreContextId,
    moduleFolderId,
    SITECORE_TEMPLATES.SETTINGS_ITEM,
    name,
  );
  if (!created) {
    throw new Error(`Failed to create ${name} item`);
  }
  return created;
}

export type SaveResult =
  | { status: "saved"; updatedAt: string }
  | { status: "conflict"; remoteUpdatedAt: string };

/**
 * Persists the blob to the Data item in the base environment. Unless
 * `overwrite` is set, the remote blob's updatedAt is compared with
 * `expectedUpdatedAt` (the value loaded at session start / last save) so a
 * concurrent editor's save is not silently clobbered.
 */
export async function saveData(
  client: ClientSDK,
  baseEnv: EnvironmentInfo,
  data: ReconciliationData,
  expectedUpdatedAt: string,
  liveEnvironments: EnvironmentInfo[],
  overwrite = false,
): Promise<SaveResult> {
  if (!overwrite) {
    const remote = await queryItemByPath(
      client,
      baseEnv.contextId,
      STORAGE_PATHS.DATA_ITEM,
    );
    const raw = readValueField(remote);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<ReconciliationData>;
        if (
          parsed.updatedAt &&
          expectedUpdatedAt &&
          parsed.updatedAt !== expectedUpdatedAt
        ) {
          return { status: "conflict", remoteUpdatedAt: parsed.updatedAt };
        }
      } catch {
        // Unparsable remote blob: the load path already forced the user
        // through explicit recovery before any save could be dirty.
      }
    }
  }

  const moduleFolder = await ensureModuleFolder(client, baseEnv.contextId);
  await ensureSettingsItem(
    client,
    baseEnv.contextId,
    moduleFolder.itemId,
    STORAGE_PATHS.DATA_ITEM,
    DATA_ITEM_NAME,
  );

  const next: ReconciliationData = {
    ...data,
    updatedAt: new Date().toISOString(),
    environments: liveEnvironments.map((e) => ({
      tenantId: e.tenantId,
      tenantName: e.tenantName,
      tenantDisplayName: e.tenantDisplayName,
    })),
  };

  const updated = await updateItemFieldByPath(
    client,
    baseEnv.contextId,
    STORAGE_PATHS.DATA_ITEM,
    "Value",
    JSON.stringify(next),
  );
  if (!updated) {
    throw new Error("Failed to write the Data item");
  }
  return { status: "saved", updatedAt: next.updatedAt };
}

// ---------------------------------------------------------------------------
// Setup / conflict resolution / reset
// ---------------------------------------------------------------------------

function markerJson(env: EnvironmentInfo): string {
  const marker: MarkerData = {
    tenantId: env.tenantId,
    tenantName: env.tenantName,
    createdAt: new Date().toISOString(),
  };
  return JSON.stringify(marker);
}

async function createMarker(
  client: ClientSDK,
  env: EnvironmentInfo,
  markerName: string,
  markerPath: string,
): Promise<void> {
  const moduleFolder = await ensureModuleFolder(client, env.contextId);
  const marker = await ensureSettingsItem(
    client,
    env.contextId,
    moduleFolder.itemId,
    markerPath,
    markerName,
  );
  await updateItemField(
    client,
    env.contextId,
    marker.itemId,
    markerPath,
    "Value",
    markerJson(env),
    DEFAULT_LANGUAGE,
    1,
  );
}

export interface SetupResult {
  /** Secondary-marker creation failures — non-fatal, retryable per env. */
  secondaryFailures: { env: EnvironmentInfo; error: string }[];
  initialData: ReconciliationData;
}

/**
 * First-run setup: marks `baseEnv` with the Base marker + empty Data blob
 * (any failure here aborts by throwing), then marks every other environment
 * as Secondary (failures reported, not thrown).
 */
export async function setupBaseEnvironment(
  client: ClientSDK,
  baseEnv: EnvironmentInfo,
  allEnvironments: EnvironmentInfo[],
): Promise<SetupResult> {
  await createMarker(client, baseEnv, BASE_MARKER_NAME, STORAGE_PATHS.BASE_MARKER);

  const initialData = emptyReconciliationData(
    { ...baseEnv },
    allEnvironments.map((e) => ({
      tenantId: e.tenantId,
      tenantName: e.tenantName,
      tenantDisplayName: e.tenantDisplayName,
    })),
  );
  const moduleFolder = await ensureModuleFolder(client, baseEnv.contextId);
  const dataItem = await ensureSettingsItem(
    client,
    baseEnv.contextId,
    moduleFolder.itemId,
    STORAGE_PATHS.DATA_ITEM,
    DATA_ITEM_NAME,
  );
  await updateItemField(
    client,
    baseEnv.contextId,
    dataItem.itemId,
    STORAGE_PATHS.DATA_ITEM,
    "Value",
    JSON.stringify(initialData),
    DEFAULT_LANGUAGE,
    1,
  );

  const secondaryFailures: SetupResult["secondaryFailures"] = [];
  for (const env of allEnvironments) {
    if (env.tenantId === baseEnv.tenantId) continue;
    try {
      await createSecondaryMarker(client, env);
    } catch (error) {
      secondaryFailures.push({
        env,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { secondaryFailures, initialData };
}

/** Retryable on its own when setup reported a failure for this env. */
export async function createSecondaryMarker(
  client: ClientSDK,
  env: EnvironmentInfo,
): Promise<void> {
  await createMarker(
    client,
    env,
    SECONDARY_MARKER_NAME,
    STORAGE_PATHS.SECONDARY_MARKER,
  );
}

/**
 * Conflict resolution: keeps `chosenBase` as-is and, in every other
 * environment currently holding a stray Base marker, deletes that marker and
 * creates a Secondary marker instead.
 */
export async function resolveBaseConflict(
  client: ClientSDK,
  chosenBase: EnvironmentInfo,
  otherBaseEnvs: EnvironmentInfo[],
): Promise<{ failures: { env: EnvironmentInfo; error: string }[] }> {
  const failures: { env: EnvironmentInfo; error: string }[] = [];
  for (const env of otherBaseEnvs) {
    if (env.tenantId === chosenBase.tenantId) continue;
    try {
      const strayBase = await queryItemByPath(
        client,
        env.contextId,
        STORAGE_PATHS.BASE_MARKER,
      );
      if (strayBase) {
        await deleteItem(client, env.contextId, strayBase.itemId);
      }
      await createSecondaryMarker(client, env);
    } catch (error) {
      failures.push({
        env,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { failures };
}

export interface ResetEnvResult {
  env: EnvironmentInfo;
  ok: boolean;
  error?: string;
}

/**
 * Deletes the whole ContentReconciliation folder (markers + Data) in every
 * environment. Partial failures are reported per environment for retry.
 */
export async function resetAllEnvironments(
  client: ClientSDK,
  environments: EnvironmentInfo[],
): Promise<ResetEnvResult[]> {
  const results: ResetEnvResult[] = [];
  for (const env of environments) {
    try {
      const folder = await queryItemByPath(
        client,
        env.contextId,
        STORAGE_PATHS.MODULE_FOLDER,
      );
      if (folder) {
        const deleted = await deleteItem(client, env.contextId, folder.itemId);
        if (!deleted) {
          throw new Error("deleteItem reported failure");
        }
      }
      results.push({ env, ok: true });
    } catch (error) {
      results.push({
        env,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return results;
}
