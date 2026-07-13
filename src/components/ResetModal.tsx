"use client";

import { useState } from "react";
import type { ClientSDK } from "@sitecore-marketplace-sdk/client";
import type { EnvironmentInfo } from "@/src/types/reconciliation";
import { environmentLabel } from "@/src/utils/environments";
import {
  resetAllEnvironments,
  type ResetEnvResult,
} from "@/src/utils/reconciliation-store";
import { Banner, Button, Modal, Spinner, TextInput } from "./ui";

/**
 * Type-to-confirm destructive reset: deletes the ContentReconciliation
 * folder (markers + all tracked data) in every environment, returning the
 * tool to first-run setup.
 */
export function ResetModal({
  client,
  environments,
  onComplete,
  onCancel,
}: {
  client: ClientSDK;
  environments: EnvironmentInfo[];
  onComplete: () => void;
  onCancel: () => void;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<ResetEnvResult[] | null>(null);

  const failed = (results ?? []).filter((r) => !r.ok);

  const run = async (targets: EnvironmentInfo[]) => {
    setBusy(true);
    try {
      const runResults = await resetAllEnvironments(client, targets);
      const merged = results
        ? results.map(
            (r) =>
              runResults.find((n) => n.env.tenantId === r.env.tenantId) ?? r,
          )
        : runResults;
      setResults(merged);
      if (merged.every((r) => r.ok)) {
        onComplete();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Reset Content Reconciliation" onClose={busy ? undefined : onCancel}>
      <Banner tone="danger">
        This permanently deletes ALL reconciliation data — the base
        environment choice, every tracked item and field, and all captured
        values — from every environment. This cannot be undone.
      </Banner>

      <p style={{ fontSize: "var(--font-size-sm)", margin: "var(--spacing-3) 0 var(--spacing-2)" }}>
        Type <code>RESET</code> to confirm:
      </p>
      <TextInput value={confirmText} onChange={setConfirmText} placeholder="RESET" />

      {results && (
        <div style={{ margin: "var(--spacing-4) 0" }}>
          {results.map((r) => (
            <div
              key={r.env.tenantId}
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "var(--font-size-sm)",
                padding: "var(--spacing-1) 0",
              }}
            >
              <span>{environmentLabel(r.env)}</span>
              <span style={{ color: r.ok ? "var(--color-success)" : "var(--color-danger)" }}>
                {r.ok ? "✓ cleared" : `✗ ${r.error}`}
              </span>
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: "var(--spacing-2)",
          justifyContent: "flex-end",
          marginTop: "var(--spacing-4)",
          alignItems: "center",
        }}
      >
        {busy && <Spinner label="Resetting…" />}
        <Button onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        {failed.length > 0 ? (
          <Button
            variant="danger"
            disabled={busy}
            onClick={() => run(failed.map((r) => r.env))}
          >
            Retry failed ({failed.length})
          </Button>
        ) : (
          <Button
            variant="danger"
            disabled={confirmText.trim() !== "RESET" || busy || results !== null}
            onClick={() => run(environments)}
          >
            Reset everything
          </Button>
        )}
      </div>
    </Modal>
  );
}
