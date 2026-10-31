"use client";

import { useEffect, useState } from "react";
import type { TrackedItem } from "@/src/types/reconciliation";
import { environmentLabel } from "@/src/utils/environments";
import {
  getFieldSharedness,
  getItemWithFields,
  type ItemWithFields,
} from "@/src/utils/sitecore-graphql";
import { useAppState } from "@/src/context/AppStateContext";
import { ConfirmDialog } from "./ConfirmDialog";
import { FieldRow, countValues, FIELD_GRID_COLUMNS } from "./FieldRow";
import type { TreeSelection } from "./ContentTree";
import {
  Icon,
  mdiContentSave,
  mdiLinkVariant,
  mdiTranslate,
  mdiTrashCanOutline,
} from "./Icon";
import { Banner, Button, Spinner } from "./ui";

function itemValueCount(item: TrackedItem): number {
  return item.fields.reduce((sum, f) => sum + countValues(f), 0);
}

function PathPill({ path }: { path: string }) {
  return (
    <div
      className="value-box"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--spacing-2)",
        color: "var(--color-muted-foreground)",
        whiteSpace: "nowrap",
        maxWidth: "100%",
        overflow: "hidden",
      }}
      title={path}
    >
      <Icon path={mdiLinkVariant} size={0.6} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{path}</span>
    </div>
  );
}

function LanguagePill({ language }: { language: string }) {
  return (
    <div
      className="value-box"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--spacing-2)",
        color: "var(--color-muted-foreground)",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
      title={`Context language: ${language}`}
    >
      <Icon path={mdiTranslate} size={0.6} />
      <span>{language}</span>
    </div>
  );
}

/**
 * Right panel of the tracking view. Untracked items only show a "Track this
 * item" button; tracked items show their fields (from the base environment)
 * split into Content / System tabs, in a table styled after the design.
 */
export function FieldPanel({
  selection,
  language,
}: {
  selection: TreeSelection | null;
  language: string;
}) {
  const { client, baseEnv, data, dispatch, dirty, saving, save } =
    useAppState();
  const [item, setItem] = useState<ItemWithFields | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"content" | "system">("content");
  const [confirmUntrackItem, setConfirmUntrackItem] = useState(false);
  const [confirmUntrackAll, setConfirmUntrackAll] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkProgress, setBulkProgress] = useState("");

  const trackedItem = selection
    ? data.items.find((i) => i.itemId === selection.itemId)
    : undefined;

  useEffect(() => {
    if (!selection || !trackedItem) {
      setItem(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getItemWithFields(client, baseEnv.contextId, selection.itemId, language)
      .then((result) => {
        if (cancelled) return;
        setItem(result);
        if (!result) {
          setError(
            `The item has no version in language "${language}" in the base environment.`,
          );
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // trackedItem presence (not identity) controls fetching; using the
    // boolean avoids refetching on every keystroke in the value inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, baseEnv.contextId, selection?.itemId, language, !!trackedItem]);

  if (!selection) {
    return (
      <div
        style={{
          color: "var(--color-muted-foreground)",
          fontSize: "var(--font-size-sm)",
          padding: "var(--spacing-8) 0",
          textAlign: "center",
        }}
      >
        Select an item in the content tree of {environmentLabel(baseEnv)} to
        start tracking it.
      </div>
    );
  }

  if (!trackedItem) {
    return (
      /* The card provides no top padding (see page.tsx) — add it here. */
      <div style={{ paddingTop: "var(--spacing-6)" }}>
        <h5 style={{ marginBottom: "var(--spacing-2)" }}>{selection.path}</h5>
        <p
          style={{
            fontSize: "var(--font-size-sm)",
            color: "var(--color-muted-foreground)",
            margin: "var(--spacing-4) 0",
          }}
        >
          This item is not tracked yet. Track it to choose which of its fields
          should be reconciled per environment.
        </p>
        <Button
          variant="primary"
          onClick={() =>
            dispatch({
              type: "TRACK_ITEM",
              itemId: selection.itemId,
              path: selection.path,
              name: selection.name,
            })
          }
        >
          Track this item for reconciliation
        </Button>
      </div>
    );
  }

  const fieldNodes = item?.fields?.nodes ?? [];
  const contentFields = fieldNodes.filter((f) => !f.name.startsWith("__"));
  const systemFields = fieldNodes.filter((f) => f.name.startsWith("__"));
  const visibleFields = tab === "content" ? contentFields : systemFields;
  const trackedByFieldId = new Map(
    trackedItem.fields.map((f) => [f.fieldId, f]),
  );
  // Tracked fields no longer present on the fetched item (renamed/removed
  // from the template) still need to be visible and removable.
  const fetchedFieldIds = new Set(
    fieldNodes.map((f) => f.fieldId).filter(Boolean),
  );
  const missingTracked = trackedItem.fields.filter(
    (f) =>
      !fetchedFieldIds.has(f.fieldId) &&
      (tab === "content" ? !f.isSystem : f.isSystem),
  );

  const trackableVisible = visibleFields.filter((f) => f.fieldId);
  const allVisibleTracked =
    trackableVisible.length > 0 &&
    trackableVisible.every((f) => trackedByFieldId.has(f.fieldId!));

  const handleTrackAll = async () => {
    setBulkBusy(true);
    try {
      const untracked = trackableVisible.filter(
        (f) => !trackedByFieldId.has(f.fieldId!),
      );
      for (let i = 0; i < untracked.length; i++) {
        const fieldNode = untracked[i];
        setBulkProgress(`Tracking ${i + 1}/${untracked.length}: ${fieldNode.name}`);
        let shared: boolean | null = null;
        try {
          shared = await getFieldSharedness(
            client,
            baseEnv.contextId,
            fieldNode.fieldId!,
          );
        } catch {
          shared = null;
        }
        dispatch({
          type: "TRACK_FIELD",
          itemId: trackedItem.itemId,
          field: {
            fieldId: fieldNode.fieldId!,
            name: fieldNode.name,
            shared: shared === true,
            isSystem: fieldNode.name.startsWith("__"),
            values: {},
          },
        });
      }
    } finally {
      setBulkProgress("");
      setBulkBusy(false);
    }
  };

  const handleUntrackAll = () => {
    for (const f of trackedItem.fields) {
      const visible = tab === "content" ? !f.isSystem : f.isSystem;
      if (visible) {
        dispatch({
          type: "UNTRACK_FIELD",
          itemId: trackedItem.itemId,
          fieldId: f.fieldId,
        });
      }
    }
  };

  const visibleTrackedValueCount = trackedItem.fields
    .filter((f) => (tab === "content" ? !f.isSystem : f.isSystem))
    .reduce((sum, f) => sum + countValues(f), 0);

  return (
    <div>
      {/* Sticky header: the card has no top padding, so this sticks flush to
          its top edge; negative side margins stretch it over the card's
          horizontal padding so field rows scrolling beneath are covered. */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "var(--color-background)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--spacing-3)",
          margin: "0 calc(-1 * var(--spacing-8)) var(--spacing-4)",
          padding: "var(--spacing-6) var(--spacing-8) var(--spacing-3)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        {/* Row 1 — plain path text left, language pill right */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--spacing-2)",
            minWidth: 0,
          }}
        >
          <h5
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              minWidth: 0,
            }}
            title={selection.path}
          >
            {selection.path}
          </h5>
          <LanguagePill language={language} />
        </div>

        {/* Row 2 — field tabs left, actions right */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--spacing-4)",
          }}
        >
          <div className="segmented">
            {(
              [
                ["content", `Content Fields (${contentFields.length})`],
                ["system", `System Fields (${systemFields.length})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={tab === key ? "active" : undefined}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--spacing-2)",
            }}
          >
          {saving && <Spinner label="Saving…" />}
          <Button
            style={{
              background: "var(--color-background)",
              color: "var(--color-danger)",
              border: "1px solid var(--color-danger)",
            }}
            onClick={() => {
              if (
                itemValueCount(trackedItem) > 0 ||
                trackedItem.fields.length > 0
              ) {
                setConfirmUntrackItem(true);
              } else {
                dispatch({ type: "UNTRACK_ITEM", itemId: trackedItem.itemId });
              }
            }}
          >
            <Icon path={mdiTrashCanOutline} size={0.65} />
            Untrack Item
          </Button>
          <Button
            variant="primary"
            disabled={!dirty || saving}
            onClick={() => save()}
            title={
              dirty
                ? "Save tracking changes to the base environment"
                : "No unsaved changes"
            }
          >
            <Icon path={mdiContentSave} size={0.65} />
            Save
          </Button>
          </div>
        </div>
      </div>

      {loading && <Spinner label="Loading fields…" />}
      {error && <Banner tone="danger">{error}</Banner>}
      {bulkBusy && (
        <Banner tone="info">
          <Spinner label={bulkProgress || "Tracking fields…"} />
        </Banner>
      )}

      {!loading && (visibleFields.length > 0 || missingTracked.length > 0) && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: FIELD_GRID_COLUMNS,
            alignItems: "center",
            gap: "var(--spacing-3)",
            background: "var(--color-muted)",
            borderRadius: "var(--radius-lg)",
            padding: "var(--spacing-2-5) var(--spacing-3)",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--font-size-sm)",
            fontWeight: 600,
          }}
        >
          <input
            type="checkbox"
            checked={allVisibleTracked}
            disabled={bulkBusy || trackableVisible.length === 0}
            title={
              allVisibleTracked
                ? "Untrack all fields in this tab"
                : "Track all fields in this tab"
            }
            onChange={() => {
              if (allVisibleTracked) {
                if (visibleTrackedValueCount > 0) {
                  setConfirmUntrackAll(true);
                } else {
                  handleUntrackAll();
                }
              } else {
                handleTrackAll();
              }
            }}
          />
          <span>Field Name</span>
          <span>Current Value</span>
        </div>
      )}

      {!loading &&
        visibleFields.map((fieldNode) => (
          <FieldRow
            key={fieldNode.fieldId ?? fieldNode.name}
            itemId={trackedItem.itemId}
            fieldNode={fieldNode}
            tracked={
              fieldNode.fieldId
                ? trackedByFieldId.get(fieldNode.fieldId)
                : undefined
            }
            currentLanguage={language}
          />
        ))}

      {!loading &&
        missingTracked.map((tracked) => (
          <FieldRow
            key={tracked.fieldId}
            itemId={trackedItem.itemId}
            fieldNode={{
              name: `${tracked.name} (no longer on this item)`,
              fieldId: tracked.fieldId,
              value: "",
            }}
            tracked={tracked}
            currentLanguage={language}
          />
        ))}

      {confirmUntrackItem && (
        <ConfirmDialog
          title="Untrack item"
          message={`"${trackedItem.name}" has ${trackedItem.fields.length} tracked field(s) and ${itemValueCount(trackedItem)} captured value(s). Untracking deletes all of them from the reconciliation data and saves immediately. Continue?`}
          confirmLabel="Untrack item"
          danger
          onConfirm={() => {
            dispatch({ type: "UNTRACK_ITEM", itemId: trackedItem.itemId });
            setConfirmUntrackItem(false);
            // The dispatch result isn't visible here yet — save the
            // post-untrack snapshot explicitly.
            save(false, {
              ...data,
              items: data.items.filter((i) => i.itemId !== trackedItem.itemId),
            });
          }}
          onCancel={() => setConfirmUntrackItem(false)}
        />
      )}

      {confirmUntrackAll && (
        <ConfirmDialog
          title="Untrack all fields"
          message={`The tracked fields in this tab have ${visibleTrackedValueCount} captured value(s). Untracking deletes them from the reconciliation data (after you save). Continue?`}
          confirmLabel="Untrack all"
          danger
          onConfirm={() => {
            handleUntrackAll();
            setConfirmUntrackAll(false);
          }}
          onCancel={() => setConfirmUntrackAll(false)}
        />
      )}
    </div>
  );
}
