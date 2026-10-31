"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
} from "react";
import type { ClientSDK } from "@sitecore-marketplace-sdk/client";
import type {
  EnvironmentInfo,
  ReconciliationData,
  TrackedField,
  TrackedItem,
} from "@/src/types/reconciliation";
import { loadData, saveData } from "@/src/utils/reconciliation-store";

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

interface TrackingState {
  data: ReconciliationData;
  dirty: boolean;
  /** updatedAt of the blob as loaded/last saved — concurrency baseline. */
  loadedUpdatedAt: string;
}

export type TrackingAction =
  | { type: "LOAD"; data: ReconciliationData }
  | { type: "TRACK_ITEM"; itemId: string; path: string; name: string }
  | { type: "UNTRACK_ITEM"; itemId: string }
  | { type: "TRACK_FIELD"; itemId: string; field: TrackedField }
  | { type: "UNTRACK_FIELD"; itemId: string; fieldId: string }
  | {
      type: "SET_VALUE";
      itemId: string;
      fieldId: string;
      tenantName: string;
      valueKey: string;
      value: string;
    }
  | {
      type: "UNSET_VALUE";
      itemId: string;
      fieldId: string;
      tenantName: string;
      valueKey: string;
    }
  | {
      type: "DELETE_ENV_VALUES";
      itemId: string;
      fieldId: string;
      tenantName: string;
    }
  | { type: "MARK_SAVED"; updatedAt: string };

function updateItem(
  data: ReconciliationData,
  itemId: string,
  update: (item: TrackedItem) => TrackedItem,
): ReconciliationData {
  return {
    ...data,
    items: data.items.map((item) =>
      item.itemId === itemId ? update(item) : item,
    ),
  };
}

function updateField(
  data: ReconciliationData,
  itemId: string,
  fieldId: string,
  update: (field: TrackedField) => TrackedField,
): ReconciliationData {
  return updateItem(data, itemId, (item) => ({
    ...item,
    fields: item.fields.map((field) =>
      field.fieldId === fieldId ? update(field) : field,
    ),
  }));
}

function reducer(state: TrackingState, action: TrackingAction): TrackingState {
  switch (action.type) {
    case "LOAD":
      return {
        data: action.data,
        dirty: false,
        loadedUpdatedAt: action.data.updatedAt,
      };
    case "MARK_SAVED":
      return {
        ...state,
        data: { ...state.data, updatedAt: action.updatedAt },
        dirty: false,
        loadedUpdatedAt: action.updatedAt,
      };
    case "TRACK_ITEM": {
      if (state.data.items.some((i) => i.itemId === action.itemId)) {
        return state;
      }
      return {
        ...state,
        dirty: true,
        data: {
          ...state.data,
          items: [
            ...state.data.items,
            {
              itemId: action.itemId,
              path: action.path,
              name: action.name,
              fields: [],
            },
          ],
        },
      };
    }
    case "UNTRACK_ITEM":
      return {
        ...state,
        dirty: true,
        data: {
          ...state.data,
          items: state.data.items.filter((i) => i.itemId !== action.itemId),
        },
      };
    case "TRACK_FIELD":
      return {
        ...state,
        dirty: true,
        data: updateItem(state.data, action.itemId, (item) =>
          item.fields.some((f) => f.fieldId === action.field.fieldId)
            ? item
            : { ...item, fields: [...item.fields, action.field] },
        ),
      };
    case "UNTRACK_FIELD":
      return {
        ...state,
        dirty: true,
        data: updateItem(state.data, action.itemId, (item) => ({
          ...item,
          fields: item.fields.filter((f) => f.fieldId !== action.fieldId),
        })),
      };
    case "SET_VALUE":
      return {
        ...state,
        dirty: true,
        data: updateField(state.data, action.itemId, action.fieldId, (field) => ({
          ...field,
          values: {
            ...field.values,
            [action.tenantName]: {
              ...(field.values[action.tenantName] ?? {}),
              [action.valueKey]: action.value,
            },
          },
        })),
      };
    case "UNSET_VALUE":
      return {
        ...state,
        dirty: true,
        data: updateField(state.data, action.itemId, action.fieldId, (field) => {
          const envValues = { ...(field.values[action.tenantName] ?? {}) };
          delete envValues[action.valueKey];
          const values = { ...field.values };
          if (Object.keys(envValues).length === 0) {
            delete values[action.tenantName];
          } else {
            values[action.tenantName] = envValues;
          }
          return { ...field, values };
        }),
      };
    case "DELETE_ENV_VALUES":
      return {
        ...state,
        dirty: true,
        data: updateField(state.data, action.itemId, action.fieldId, (field) => {
          const values = { ...field.values };
          delete values[action.tenantName];
          return { ...field, values };
        }),
      };
    default:
      return state;
  }
}

/**
 * Remaps desired-value keys after tenant renames: any stored environment
 * (matched by tenantId) whose tenantName changed gets its value keys moved
 * to the new name. Runs right before save.
 */
export function migrateTenantNames(
  data: ReconciliationData,
  liveEnvironments: EnvironmentInfo[],
): ReconciliationData {
  const renames = new Map<string, string>();
  for (const stored of data.environments) {
    const live = liveEnvironments.find((e) => e.tenantId === stored.tenantId);
    if (live && live.tenantName !== stored.tenantName) {
      renames.set(stored.tenantName, live.tenantName);
    }
  }
  if (renames.size === 0) return data;

  return {
    ...data,
    items: data.items.map((item) => ({
      ...item,
      fields: item.fields.map((field) => {
        const values: TrackedField["values"] = {};
        for (const [tenantName, langValues] of Object.entries(field.values)) {
          values[renames.get(tenantName) ?? tenantName] = langValues;
        }
        return { ...field, values };
      }),
    })),
  };
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface AppStateValue {
  client: ClientSDK;
  environments: EnvironmentInfo[];
  baseEnv: EnvironmentInfo;
  languages: string[];
  data: ReconciliationData;
  dirty: boolean;
  saving: boolean;
  /** Remote updatedAt when the last save hit a concurrency conflict. */
  saveConflict: string | null;
  saveError: string | null;
  /** True for a few seconds after a successful save (drives the toast). */
  savedToast: boolean;
  dispatch: Dispatch<TrackingAction>;
  /**
   * Persists the blob. `dataOverride` saves that snapshot instead of the
   * reducer state — used when saving immediately after a dispatch, whose
   * result is not visible to this closure yet.
   */
  save: (overwrite?: boolean, dataOverride?: ReconciliationData) => Promise<void>;
  /** Discards local changes and reloads the blob from the base env. */
  reload: () => Promise<void>;
}

const AppStateContext = createContext<AppStateValue | null>(null);

export function useAppState(): AppStateValue {
  const value = useContext(AppStateContext);
  if (!value) {
    throw new Error("useAppState must be used within AppStateProvider");
  }
  return value;
}

export function AppStateProvider({
  client,
  environments,
  baseEnv,
  languages,
  initialData,
  children,
}: {
  client: ClientSDK;
  environments: EnvironmentInfo[];
  baseEnv: EnvironmentInfo;
  languages: string[];
  initialData: ReconciliationData;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, {
    data: initialData,
    dirty: false,
    loadedUpdatedAt: initialData.updatedAt,
  });
  const [saving, setSaving] = useState(false);
  const [saveConflict, setSaveConflict] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showSavedToast = useCallback(() => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setSavedToast(true);
    toastTimerRef.current = setTimeout(() => setSavedToast(false), 3000);
  }, []);

  useEffect(() => {
    if (!state.dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [state.dirty]);

  const save = useCallback(
    async (overwrite = false, dataOverride?: ReconciliationData) => {
      setSaving(true);
      setSaveError(null);
      try {
        const migrated = migrateTenantNames(
          dataOverride ?? state.data,
          environments,
        );
        const result = await saveData(
          client,
          baseEnv,
          migrated,
          state.loadedUpdatedAt,
          environments,
          overwrite,
        );
        if (result.status === "conflict") {
          setSaveConflict(result.remoteUpdatedAt);
          return;
        }
        setSaveConflict(null);
        dispatch({ type: "MARK_SAVED", updatedAt: result.updatedAt });
        showSavedToast();
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : String(error));
      } finally {
        setSaving(false);
      }
    },
    [client, baseEnv, environments, state.data, state.loadedUpdatedAt, showSavedToast],
  );

  const reload = useCallback(async () => {
    setSaveError(null);
    const result = await loadData(client, baseEnv, environments);
    if (result.ok) {
      setSaveConflict(null);
      dispatch({ type: "LOAD", data: result.data });
    } else {
      setSaveError(
        "The stored data could not be parsed — reload the app to recover it.",
      );
    }
  }, [client, baseEnv, environments]);

  return (
    <AppStateContext.Provider
      value={{
        client,
        environments,
        baseEnv,
        languages,
        data: state.data,
        dirty: state.dirty,
        saving,
        saveConflict,
        saveError,
        savedToast,
        dispatch,
        save,
        reload,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
}
