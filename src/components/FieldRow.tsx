"use client";

import { useState } from "react";
import { SHARED_VALUE_KEY } from "@/src/constants";
import type { TrackedField } from "@/src/types/reconciliation";
import { environmentLabel } from "@/src/utils/environments";
import {
  getFieldSharedness,
  getFieldValuePerLanguage,
  type FieldNode,
} from "@/src/utils/sitecore-graphql";
import { useAppState } from "@/src/context/AppStateContext";
import { ConfirmDialog } from "./ConfirmDialog";
import { Icon, mdiDownload } from "./Icon";
import { Button, Spinner } from "./ui";

/** Shared by the header row in FieldPanel and every FieldRow. */
export const FIELD_GRID_COLUMNS = "16px 260px 1fr";

function countValues(field: TrackedField): number {
  return Object.values(field.values).reduce(
    (sum, langValues) => sum + Object.keys(langValues).length,
    0,
  );
}

/**
 * One field of the selected item: track checkbox | field name | read-only
 * base value box. When tracked, a capture panel appears below with one
 * desired-value input per environment (per language, unless shared).
 */
export function FieldRow({
  itemId,
  fieldNode,
  tracked,
  currentLanguage,
}: {
  itemId: string;
  /** The field as fetched from the base environment (current language). */
  fieldNode: FieldNode;
  tracked: TrackedField | undefined;
  currentLanguage: string;
}) {
  const { client, baseEnv, environments, languages, dispatch } = useAppState();
  const [resolvingShared, setResolvingShared] = useState(false);
  const [sharednessNotice, setSharednessNotice] = useState<string | null>(null);
  const [confirmUntrack, setConfirmUntrack] = useState(false);
  const [expanded, setExpanded] = useState(false);
  /** tenantId of the environment whose values are being fetched. */
  const [capturingEnv, setCapturingEnv] = useState<string | null>(null);
  /** Per-tenantId skip/failure notice of the last capture. */
  const [captureNotices, setCaptureNotices] = useState<Record<string, string>>(
    {},
  );

  const fieldId = fieldNode.fieldId ?? "";
  const isTracked = !!tracked;

  const handleTrack = async () => {
    if (!fieldId) {
      setSharednessNotice(
        "This field has no field id — it cannot be tracked.",
      );
      return;
    }
    setResolvingShared(true);
    setSharednessNotice(null);
    let shared: boolean | null = null;
    let failed = false;
    try {
      shared = await getFieldSharedness(client, baseEnv.contextId, fieldId);
    } catch (error) {
      failed = true;
      setSharednessNotice(
        `Could not determine whether this field is shared (${error instanceof Error ? error.message : String(error)}) — treating it as language-specific.`,
      );
    }
    if (shared === null && !failed) {
      setSharednessNotice(
        "The field definition item could not be resolved — treating this field as language-specific.",
      );
    }
    dispatch({
      type: "TRACK_FIELD",
      itemId,
      field: {
        fieldId,
        name: fieldNode.name,
        shared: shared === true,
        isSystem: fieldNode.name.startsWith("__"),
        values: {},
      },
    });
    setResolvingShared(false);
  };

  const handleUncheck = () => {
    if (tracked && countValues(tracked) > 0) {
      setConfirmUntrack(true);
    } else {
      dispatch({ type: "UNTRACK_FIELD", itemId, fieldId });
    }
  };

  // Base environment first, then the rest.
  const orderedEnvs = [
    ...environments.filter((e) => e.tenantId === baseEnv.tenantId),
    ...environments.filter((e) => e.tenantId !== baseEnv.tenantId),
  ];
  const liveTenantNames = new Set(environments.map((e) => e.tenantName));
  const orphanedTenants = tracked
    ? Object.keys(tracked.values).filter((t) => !liveTenantNames.has(t))
    : [];

  const valueKeys = tracked?.shared ? [SHARED_VALUE_KEY] : languages;

  /**
   * Shortcut: read the field's current value from one environment and store
   * it as the desired value — per language, or once (first language that has
   * a version) for shared fields. Missing items/versions are skipped so
   * apply keeps ignoring them. Nothing is saved until the user hits Save.
   */
  const handleCaptureEnv = async (env: (typeof orderedEnvs)[number]) => {
    if (!tracked) return;
    setCapturingEnv(env.tenantId);
    setCaptureNotices((notices) => {
      const next = { ...notices };
      delete next[env.tenantId];
      return next;
    });
    const skipped: string[] = [];
    let failure: string | null = null;
    try {
      const byLanguage = await getFieldValuePerLanguage(
        client,
        env.contextId,
        itemId,
        tracked.name,
        languages,
      );
      if (tracked.shared) {
        const value = languages
          .map((lang) => byLanguage[lang])
          .find((v) => v !== null);
        if (value === undefined) {
          skipped.push("no language has a version of this item here");
        } else {
          dispatch({
            type: "SET_VALUE",
            itemId,
            fieldId,
            tenantName: env.tenantName,
            valueKey: SHARED_VALUE_KEY,
            value,
          });
        }
      } else {
        for (const lang of languages) {
          const value = byLanguage[lang];
          if (value === null) {
            skipped.push(lang);
          } else {
            dispatch({
              type: "SET_VALUE",
              itemId,
              fieldId,
              tenantName: env.tenantName,
              valueKey: lang,
              value,
            });
          }
        }
      }
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
    } finally {
      setCapturingEnv(null);
    }
    const notice = failure
      ? `Failed: ${failure}`
      : skipped.length > 0
        ? `Skipped (no version): ${skipped.join(", ")}`
        : null;
    if (notice) {
      setCaptureNotices((notices) => ({ ...notices, [env.tenantId]: notice }));
    }
  };

  const baseValue = fieldNode.value ?? "";
  const showToggle = baseValue.length > 200;

  return (
    <div style={{ borderBottom: "1px solid var(--color-border)" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: FIELD_GRID_COLUMNS,
          alignItems: "center",
          gap: "var(--spacing-3)",
          padding: "var(--spacing-3)",
        }}
      >
        <input
          type="checkbox"
          checked={isTracked}
          disabled={resolvingShared}
          onChange={() => (isTracked ? handleUncheck() : handleTrack())}
          title="Track this field for reconciliation"
        />
        <div
          style={{
            fontWeight: 600,
            fontSize: "var(--font-size-base)",
            display: "flex",
            gap: "var(--spacing-2)",
            alignItems: "center",
            flexWrap: "wrap",
            minWidth: 0,
          }}
        >
          <span style={{ overflowWrap: "anywhere" }}>{fieldNode.name}</span>
          {resolvingShared && (
            <span
              style={{
                fontWeight: 400,
                fontSize: "var(--font-size-2xs)",
                color: "var(--color-muted-foreground)",
              }}
            >
              checking if shared…
            </span>
          )}
          {tracked?.shared && (
            <span
              style={{
                fontSize: "var(--font-size-3xs)",
                background: "var(--color-primary-soft)",
                color: "var(--color-primary-soft-foreground)",
                borderRadius: "var(--radius-md)",
                padding: "var(--spacing-0-5) var(--spacing-1-5)",
                fontWeight: 600,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              shared
            </span>
          )}
        </div>
        <div
          className="value-box"
          style={{
            color:
              baseValue === ""
                ? "var(--color-muted-foreground)"
                : "var(--color-foreground)",
          }}
          title={`Current value in ${environmentLabel(baseEnv)} (${currentLanguage}) — read-only`}
        >
          {baseValue === ""
            ? "(empty)"
            : expanded || !showToggle
              ? baseValue
              : `${baseValue.slice(0, 200)}…`}
          {showToggle && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              style={{
                border: "none",
                background: "none",
                color: "var(--color-primary)",
                cursor: "pointer",
                fontSize: "var(--font-size-xs)",
                marginLeft: "var(--spacing-1)",
                fontFamily: "var(--font-body)",
              }}
            >
              {expanded ? "show less" : "show all"}
            </button>
          )}
        </div>
      </div>

      {sharednessNotice && (
        <div
          style={{
            fontSize: "var(--font-size-xs)",
            color: "var(--color-warning)",
            padding: "0 var(--spacing-3) var(--spacing-2)",
          }}
        >
          {sharednessNotice}
        </div>
      )}

      {tracked && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--spacing-2)",
            paddingBottom: "var(--spacing-3)",
          }}
        >
          {orderedEnvs.map((env) => (
            <div
              key={env.tenantId}
              style={{
                display: "grid",
                gridTemplateColumns: FIELD_GRID_COLUMNS,
                gap: "var(--spacing-3)",
                padding: "0 var(--spacing-3)",
              }}
            >
              <span />
              <span />
              <div
                style={{
                  background: "var(--color-page)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-lg)",
                  padding: "var(--spacing-2-5) var(--spacing-3)",
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "var(--spacing-2)",
                    flexWrap: "wrap",
                    marginBottom: "var(--spacing-1-5)",
                  }}
                >
                  <span
                    style={{
                      fontSize: "var(--font-size-xs)",
                      fontWeight: 600,
                      fontFamily: "var(--font-mono)",
                      color: "var(--color-muted-foreground)",
                    }}
                  >
                    {environmentLabel(env)}
                  </span>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--spacing-2)",
                    }}
                  >
                    {capturingEnv === env.tenantId && (
                      <Spinner label="Reading…" />
                    )}
                    {capturingEnv !== env.tenantId &&
                      captureNotices[env.tenantId] && (
                        <span
                          style={{
                            fontSize: "var(--font-size-2xs)",
                            color: "var(--color-warning)",
                          }}
                        >
                          {captureNotices[env.tenantId]}
                        </span>
                      )}
                    <Button
                      disabled={capturingEnv !== null}
                      title={`Fetch this field's current value from ${environmentLabel(env)} (each language) and set it as the desired value — nothing is saved until you hit Save`}
                      style={{
                        padding: "var(--spacing-1) var(--spacing-2)",
                        fontSize: "var(--font-size-2xs)",
                      }}
                      onClick={() => handleCaptureEnv(env)}
                    >
                      <Icon path={mdiDownload} size={0.55} />
                      Set current values
                    </Button>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-1-5)" }}>
                  {valueKeys.map((key) => {
                    const stored = tracked.values[env.tenantName]?.[key];
                    const isSet = stored !== undefined;
                    return (
                      <div
                        key={key}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "var(--spacing-1-5)",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "var(--font-size-2xs)",
                            fontFamily: "var(--font-mono)",
                            width: 64,
                            flexShrink: 0,
                            color: "var(--color-muted-foreground)",
                            paddingTop: "var(--spacing-1-5)",
                          }}
                        >
                          {key === SHARED_VALUE_KEY ? "all langs" : key}
                        </span>
                        <textarea
                          value={stored ?? ""}
                          rows={2}
                          placeholder={
                            isSet
                              ? "(empty — clears the field on apply)"
                              : "(not set — apply skips this)"
                          }
                          onChange={(e) =>
                            dispatch({
                              type: "SET_VALUE",
                              itemId,
                              fieldId,
                              tenantName: env.tenantName,
                              valueKey: key,
                              value: e.target.value,
                            })
                          }
                          style={{
                            flex: 1,
                            minWidth: 0,
                            padding: "var(--spacing-1-5) var(--spacing-2-5)",
                            border: isSet
                              ? "1px solid var(--color-primary)"
                              : "1px solid var(--color-border)",
                            background: "var(--color-background)",
                            borderRadius: "var(--radius-md)",
                            fontSize: "var(--font-size-xs)",
                            fontFamily: "var(--font-mono)",
                            resize: "vertical",
                            lineHeight: 1.4,
                          }}
                        />
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "var(--spacing-1)",
                            flexShrink: 0,
                          }}
                        >
                          <Button
                            style={{
                              padding: "var(--spacing-1) var(--spacing-2)",
                              fontSize: "var(--font-size-2xs)",
                            }}
                            title='Set empty — applying writes "" to clear the field'
                            onClick={() =>
                              dispatch({
                                type: "SET_VALUE",
                                itemId,
                                fieldId,
                                tenantName: env.tenantName,
                                valueKey: key,
                                value: "",
                              })
                            }
                          >
                            set empty
                          </Button>
                          {isSet && (
                            <Button
                              style={{
                                padding: "var(--spacing-1) var(--spacing-2)",
                                fontSize: "var(--font-size-2xs)",
                              }}
                              title="Unset — remove the desired value so apply skips it"
                              onClick={() =>
                                dispatch({
                                  type: "UNSET_VALUE",
                                  itemId,
                                  fieldId,
                                  tenantName: env.tenantName,
                                  valueKey: key,
                                })
                              }
                            >
                              ✕
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}

          {orphanedTenants.map((tenantName) => (
            <div
              key={tenantName}
              style={{
                display: "grid",
                gridTemplateColumns: FIELD_GRID_COLUMNS,
                gap: "var(--spacing-3)",
                padding: "0 var(--spacing-3)",
              }}
            >
              <span />
              <span />
              <div
                style={{
                  fontSize: "var(--font-size-xs)",
                  color: "var(--color-warning)",
                  display: "flex",
                  gap: "var(--spacing-2)",
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                Values stored for unknown environment “{tenantName}” (
                {countValues({ ...tracked, values: { [tenantName]: tracked.values[tenantName] } })}{" "}
                value(s))
                <Button
                  style={{
                    padding: "var(--spacing-1) var(--spacing-2)",
                    fontSize: "var(--font-size-2xs)",
                  }}
                  onClick={() =>
                    dispatch({
                      type: "DELETE_ENV_VALUES",
                      itemId,
                      fieldId,
                      tenantName,
                    })
                  }
                >
                  delete values
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmUntrack && tracked && (
        <ConfirmDialog
          title="Untrack field"
          message={`"${fieldNode.name}" has ${countValues(tracked)} captured value(s). Untracking deletes them from the reconciliation data (after you save). Continue?`}
          confirmLabel="Untrack field"
          danger
          onConfirm={() => {
            dispatch({ type: "UNTRACK_FIELD", itemId, fieldId });
            setConfirmUntrack(false);
          }}
          onCancel={() => setConfirmUntrack(false)}
        />
      )}
    </div>
  );
}

/** Re-exported so FieldPanel can reuse the same counting rule. */
export { countValues };
