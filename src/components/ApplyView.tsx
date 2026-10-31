"use client";

import { useState } from "react";
import { DEFAULT_LANGUAGE, SHARED_VALUE_KEY } from "@/src/constants";
import type { EnvironmentInfo } from "@/src/types/reconciliation";
import { environmentLabel } from "@/src/utils/environments";
import {
  getItemWithFields,
  updateItemFields,
} from "@/src/utils/sitecore-graphql";
import { useAppState } from "@/src/context/AppStateContext";
import { ConfirmDialog } from "./ConfirmDialog";
import { Banner, Button, Spinner } from "./ui";

type RowStatus =
  | "will-update"
  | "unchanged"
  | "item-missing"
  | "no-version"
  | "updated"
  | "failed";

interface ApplyRow {
  key: string;
  itemId: string;
  itemPath: string;
  itemName: string;
  fieldId: string;
  fieldName: string;
  /** GraphQL language the update runs in. */
  language: string;
  /** Display key: language name, or "*" for shared fields. */
  valueKey: string;
  desired: string;
  current: string | null;
  status: RowStatus;
  error?: string;
}

type Phase = "pick" | "fetching" | "preview" | "executing" | "done";

const statusLabels: Record<RowStatus, { label: string; color: string }> = {
  "will-update": { label: "will update", color: "var(--color-info)" },
  unchanged: { label: "unchanged", color: "var(--color-muted-foreground)" },
  "item-missing": { label: "item missing", color: "var(--color-warning)" },
  "no-version": { label: "no version", color: "var(--color-warning)" },
  updated: { label: "✓ updated", color: "var(--color-success)" },
  failed: { label: "✗ failed", color: "var(--color-danger)" },
};

function truncate(value: string | null, max = 80): string {
  if (value === null) return "—";
  if (value === "") return "(empty)";
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

/**
 * Apply area: pick a target environment, preview what would change (current
 * vs desired), then run the updateItem mutations with per-field results.
 */
export function ApplyView() {
  const { client, environments, data, dirty } = useAppState();
  const [phase, setPhase] = useState<Phase>("pick");
  const [target, setTarget] = useState<EnvironmentInfo | null>(null);
  const [rows, setRows] = useState<ApplyRow[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [progress, setProgress] = useState("");

  /** tenantName key under which values for `env` are stored in the blob. */
  const storedKeyFor = (env: EnvironmentInfo): string =>
    data.environments.find((e) => e.tenantId === env.tenantId)?.tenantName ??
    env.tenantName;

  const buildAndFetch = async (env: EnvironmentInfo) => {
    setTarget(env);
    setPhase("fetching");
    const valuesKey = storedKeyFor(env);

    // One row per stored desired value for this environment.
    const planned: ApplyRow[] = [];
    for (const item of data.items) {
      for (const field of item.fields) {
        const envValues = field.values[valuesKey] ?? {};
        const entries = field.shared
          ? envValues[SHARED_VALUE_KEY] !== undefined
            ? [[SHARED_VALUE_KEY, envValues[SHARED_VALUE_KEY]] as const]
            : []
          : Object.entries(envValues);
        for (const [valueKey, desired] of entries) {
          planned.push({
            key: `${item.itemId}|${field.fieldId}|${valueKey}`,
            itemId: item.itemId,
            itemPath: item.path,
            itemName: item.name,
            fieldId: field.fieldId,
            fieldName: field.name,
            language:
              valueKey === SHARED_VALUE_KEY ? DEFAULT_LANGUAGE : valueKey,
            valueKey,
            desired,
            current: null,
            status: "will-update",
          });
        }
      }
    }

    if (planned.length === 0) {
      setRows([]);
      setPhase("preview");
      return;
    }

    // Fetch current values per (item, language) from the target environment.
    const groups = new Map<string, ApplyRow[]>();
    for (const row of planned) {
      const groupKey = `${row.itemId}|${row.language}`;
      groups.set(groupKey, [...(groups.get(groupKey) ?? []), row]);
    }

    let done = 0;
    for (const [, groupRows] of groups) {
      const { itemId, language } = groupRows[0];
      setProgress(`Checking ${done + 1}/${groups.size}: ${groupRows[0].itemPath} (${language})`);
      try {
        const item = await getItemWithFields(client, env.contextId, itemId, language);
        if (!item) {
          for (const row of groupRows) row.status = "item-missing";
        } else if (!item.versions?.length) {
          for (const row of groupRows) row.status = "no-version";
        } else {
          for (const row of groupRows) {
            const fieldNode =
              item.fields?.nodes?.find((f) => f.fieldId === row.fieldId) ??
              item.fields?.nodes?.find((f) => f.name === row.fieldName);
            row.current = fieldNode?.value ?? null;
            row.itemPath = item.path;
            row.status =
              row.current === row.desired ? "unchanged" : "will-update";
          }
        }
      } catch (error) {
        for (const row of groupRows) {
          row.status = "failed";
          row.error = `Fetch failed: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
      done++;
    }

    setRows(planned);
    setProgress("");
    setPhase("preview");
  };

  /**
   * Runs the update batches for the given rows. The version (and path) are
   * re-fetched right before each mutation so retries and slow previews never
   * write against a stale version.
   */
  const execute = async (targetRows: ApplyRow[]) => {
    if (!target) return;
    setPhase("executing");

    const pending = targetRows.filter((r) => r.status === "will-update" || r.status === "failed");
    const groups = new Map<string, ApplyRow[]>();
    for (const row of pending) {
      const groupKey = `${row.itemId}|${row.language}`;
      groups.set(groupKey, [...(groups.get(groupKey) ?? []), row]);
    }

    let done = 0;
    for (const [, groupRows] of groups) {
      const { itemId, language } = groupRows[0];
      setProgress(`Applying ${done + 1}/${groups.size}: ${groupRows[0].itemPath} (${language})`);
      try {
        const item = await getItemWithFields(client, target.contextId, itemId, language);
        if (!item) {
          throw new Error("Item not found in the target environment");
        }
        const versions = (item.versions ?? []).map((v) => v.version);
        if (!versions.length) {
          throw new Error(`No version exists in language "${language}"`);
        }
        const updated = await updateItemFields(
          client,
          target.contextId,
          itemId,
          item.path,
          groupRows.map((r) => ({ name: r.fieldName, value: r.desired })),
          language,
          Math.max(...versions),
        );
        if (!updated) {
          throw new Error("updateItem returned no item");
        }
        for (const row of groupRows) {
          row.status = "updated";
          row.error = undefined;
        }
      } catch (error) {
        for (const row of groupRows) {
          row.status = "failed";
          row.error = error instanceof Error ? error.message : String(error);
        }
      }
      done++;
      setRows((prev) => [...prev]);
    }

    setProgress("");
    setRows((prev) => [...prev]);
    setPhase("done");
  };

  const reset = () => {
    setPhase("pick");
    setTarget(null);
    setRows([]);
  };

  const willUpdate = rows.filter((r) => r.status === "will-update");
  const failed = rows.filter((r) => r.status === "failed");
  const updated = rows.filter((r) => r.status === "updated");
  const skipped = rows.filter(
    (r) => r.status === "unchanged" || r.status === "item-missing" || r.status === "no-version",
  );

  return (
    <div>
      {dirty && (
        <Banner tone="warning">
          You have unsaved tracking changes — Apply always uses the last{" "}
          <strong>saved</strong> data. Save first if you want your latest edits
          applied.
        </Banner>
      )}

      {phase === "pick" && (
        <>
          <h5 style={{ marginBottom: "var(--spacing-2)" }}>
            Apply reconciliation
          </h5>
          <p
            style={{
              fontSize: "var(--font-size-sm)",
              color: "var(--color-muted-foreground)",
              marginBottom: "var(--spacing-4)",
            }}
          >
            Select the environment to reconcile. The tool fetches the current
            values of every tracked field from that environment, shows you a
            preview of what would change, and only writes after you confirm.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-2)", maxWidth: 480 }}>
            {environments.map((env) => (
              <button
                key={env.tenantId}
                type="button"
                className="card"
                onClick={() => buildAndFetch(env)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: "var(--spacing-0-5)",
                  padding: "var(--spacing-3) var(--spacing-4)",
                  cursor: "pointer",
                  textAlign: "left",
                  font: "inherit",
                }}
              >
                <span style={{ fontWeight: 600 }}>{environmentLabel(env)}</span>
                <span
                  style={{
                    fontSize: "var(--font-size-xs)",
                    fontFamily: "var(--font-mono)",
                    color: "var(--color-muted-foreground)",
                  }}
                >
                  {env.tenantName}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {phase === "fetching" && (
        <div>
          <Spinner label={`Fetching current values from ${target ? environmentLabel(target) : ""}…`} />
          <div
            style={{
              fontSize: "var(--font-size-xs)",
              color: "var(--color-muted-foreground)",
              marginTop: "var(--spacing-2)",
            }}
          >
            {progress}
          </div>
        </div>
      )}

      {(phase === "preview" || phase === "executing" || phase === "done") && target && (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--spacing-3)",
              marginBottom: "var(--spacing-3)",
            }}
          >
            <h5>
              {phase === "done" ? "Results" : "Preview"} — {environmentLabel(target)}
            </h5>
            <Button onClick={reset} disabled={phase === "executing"}>
              ← choose another environment
            </Button>
          </div>

          <div
            style={{
              fontSize: "var(--font-size-sm)",
              marginBottom: "var(--spacing-3)",
              display: "flex",
              gap: "var(--spacing-4)",
              flexWrap: "wrap",
            }}
          >
            {phase === "done" ? (
              <>
                <span style={{ color: "var(--color-success)" }}>{updated.length} updated</span>
                <span style={{ color: "var(--color-danger)" }}>{failed.length} failed</span>
                <span style={{ color: "var(--color-muted-foreground)" }}>{skipped.length} skipped</span>
              </>
            ) : (
              <>
                <span style={{ color: "var(--color-info)" }}>{willUpdate.length} to update</span>
                <span style={{ color: "var(--color-muted-foreground)" }}>{skipped.length} skipped</span>
                {failed.length > 0 && (
                  <span style={{ color: "var(--color-danger)" }}>{failed.length} fetch failures</span>
                )}
              </>
            )}
          </div>

          {phase === "executing" && (
            <div style={{ marginBottom: "var(--spacing-3)" }}>
              <Spinner label={progress || "Applying…"} />
            </div>
          )}

          {rows.length === 0 ? (
            <Banner tone="info">
              No desired values are stored for this environment yet. Capture
              values in the Tracking tab (and save) first.
            </Banner>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  borderCollapse: "collapse",
                  width: "100%",
                  fontSize: "var(--font-size-xs)",
                }}
              >
                <thead>
                  <tr>
                    {["Item", "Field", "Language", "Current value", "Desired value", "Status"].map(
                      (h) => (
                        <th
                          key={h}
                          style={{
                            textAlign: "left",
                            background: "var(--color-muted)",
                            fontFamily: "var(--font-mono)",
                            fontWeight: 600,
                            padding: "var(--spacing-2-5) var(--spacing-3)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const muted = row.status === "unchanged";
                    return (
                      <tr key={row.key} style={{ opacity: muted ? 0.55 : 1 }}>
                        <td
                          style={{
                            padding: "var(--spacing-1-5) var(--spacing-2)",
                            borderBottom: "1px solid var(--color-border)",
                            fontFamily: "var(--font-mono)",
                            maxWidth: 260,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={row.itemPath}
                        >
                          {row.itemPath}
                        </td>
                        <td style={{ padding: "var(--spacing-1-5) var(--spacing-2)", borderBottom: "1px solid var(--color-border)" }}>
                          {row.fieldName}
                        </td>
                        <td style={{ padding: "var(--spacing-1-5) var(--spacing-2)", borderBottom: "1px solid var(--color-border)" }}>
                          {row.valueKey === SHARED_VALUE_KEY ? "shared" : row.valueKey}
                        </td>
                        <td
                          style={{
                            padding: "var(--spacing-1-5) var(--spacing-2)",
                            borderBottom: "1px solid var(--color-border)",
                            fontFamily: "var(--font-mono)",
                          }}
                          title={row.current ?? undefined}
                        >
                          {truncate(row.current)}
                        </td>
                        <td
                          style={{
                            padding: "var(--spacing-1-5) var(--spacing-2)",
                            borderBottom: "1px solid var(--color-border)",
                            fontFamily: "var(--font-mono)",
                          }}
                          title={row.desired}
                        >
                          {truncate(row.desired)}
                        </td>
                        <td
                          style={{
                            padding: "var(--spacing-1-5) var(--spacing-2)",
                            borderBottom: "1px solid var(--color-border)",
                          }}
                          title={row.error}
                        >
                          <span
                            style={{
                              display: "inline-block",
                              border: `1px solid ${statusLabels[row.status].color}`,
                              color: statusLabels[row.status].color,
                              borderRadius: "var(--radius-full)",
                              padding: "0 var(--spacing-2)",
                              fontSize: "var(--font-size-2xs)",
                              fontWeight: 600,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {statusLabels[row.status].label}
                          </span>
                          {row.error && (
                            <span
                              style={{
                                display: "block",
                                color: "var(--color-danger)",
                                fontSize: "var(--font-size-2xs)",
                                marginTop: "var(--spacing-0-5)",
                              }}
                            >
                              {row.error}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ marginTop: "var(--spacing-4)", display: "flex", gap: "var(--spacing-2)" }}>
            {phase === "preview" && (
              <Button
                variant="primary"
                disabled={willUpdate.length === 0}
                onClick={() => setConfirming(true)}
              >
                Apply {willUpdate.length} change(s)
              </Button>
            )}
            {phase === "done" && failed.length > 0 && (
              <Button variant="primary" onClick={() => execute(failed)}>
                Retry failed ({failed.length})
              </Button>
            )}
          </div>
        </>
      )}

      {confirming && target && (
        <ConfirmDialog
          title="Apply reconciliation"
          message={`This writes ${willUpdate.length} field value(s) in ${environmentLabel(target)}. Continue?`}
          confirmLabel={`Apply to ${environmentLabel(target)}`}
          danger
          onConfirm={() => {
            setConfirming(false);
            execute(willUpdate);
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
