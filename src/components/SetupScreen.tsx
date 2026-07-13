"use client";

import { useState } from "react";
import type { EnvironmentInfo } from "@/src/types/reconciliation";
import { environmentLabel } from "@/src/utils/environments";
import { ConfirmDialog } from "./ConfirmDialog";
import { Banner, Button, Spinner } from "./ui";

/**
 * First-run screen: the user is locked here until a base environment is
 * chosen. The choice is permanent (only a full reset can change it).
 */
export function SetupScreen({
  environments,
  straySecondaries,
  unreachable,
  busy,
  error,
  onSetup,
}: {
  environments: EnvironmentInfo[];
  /** Environments that already hold a Secondary marker but no base exists. */
  straySecondaries: EnvironmentInfo[];
  /** Environments whose detection queries failed. */
  unreachable: { env: EnvironmentInfo; error: string }[];
  busy: boolean;
  error: string | null;
  onSetup: (baseEnv: EnvironmentInfo) => void;
}) {
  const [selected, setSelected] = useState<EnvironmentInfo | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const needsAcknowledgement = unreachable.length > 0;
  const canSetup =
    selected !== null && !busy && (!needsAcknowledgement || acknowledged);

  return (
    <div
      className="card"
      style={{
        maxWidth: 640,
        margin: "var(--spacing-10) auto",
        padding: "var(--spacing-8)",
      }}
    >
      <h3 style={{ marginBottom: "var(--spacing-2)" }}>
        Select a Base Environment
      </h3>
      <p
        style={{
          fontSize: "var(--font-size-sm)",
          color: "var(--color-muted-foreground)",
          marginBottom: "var(--spacing-5)",
        }}
      >
        The base environment stores all reconciliation data and provides the
        content tree you will track items from. We recommend using your{" "}
        <strong>Production</strong> environment. This choice is permanent — it
        can only be changed by resetting the tool, which deletes all stored
        reconciliation data.
      </p>

      {straySecondaries.length > 0 && (
        <Banner tone="warning">
          Secondary markers were found in{" "}
          {straySecondaries.map(environmentLabel).join(", ")} but no base
          environment exists. The previous base environment may no longer be
          accessible to this app. Completing setup starts fresh.
        </Banner>
      )}

      {unreachable.length > 0 && (
        <Banner tone="danger">
          <div style={{ marginBottom: "var(--spacing-2)" }}>
            Some environments could not be checked — one of them might already
            be the base environment. Running setup now could create a second
            base:
            <ul style={{ margin: "var(--spacing-1) 0 0 var(--spacing-5)" }}>
              {unreachable.map(({ env, error: envError }) => (
                <li key={env.tenantId}>
                  {environmentLabel(env)}: {envError}
                </li>
              ))}
            </ul>
          </div>
          <label
            style={{
              display: "flex",
              gap: "var(--spacing-2)",
              alignItems: "center",
              fontSize: "var(--font-size-sm)",
            }}
          >
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
            />
            I understand and want to set up anyway
          </label>
        </Banner>
      )}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--spacing-2)",
          marginBottom: "var(--spacing-5)",
        }}
      >
        {environments.map((env) => (
          <label
            key={env.tenantId}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--spacing-3)",
              padding: "var(--spacing-3)",
              border:
                selected?.tenantId === env.tenantId
                  ? "2px solid var(--color-primary)"
                  : "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
            }}
          >
            <input
              type="radio"
              name="base-env"
              checked={selected?.tenantId === env.tenantId}
              onChange={() => setSelected(env)}
            />
            <div>
              <div style={{ fontWeight: 600, fontSize: "var(--font-size-base)" }}>
                {environmentLabel(env)}
              </div>
              <div
                style={{
                  fontSize: "var(--font-size-xs)",
                  color: "var(--color-muted-foreground)",
                }}
              >
                {env.tenantName}
              </div>
            </div>
          </label>
        ))}
      </div>

      {error && <Banner tone="danger">Setup failed: {error}</Banner>}

      <div style={{ display: "flex", gap: "var(--spacing-3)", alignItems: "center" }}>
        <Button
          variant="primary"
          disabled={!canSetup}
          onClick={() => setConfirming(true)}
        >
          Set as Base Environment
        </Button>
        {busy && <Spinner label="Setting up environments…" />}
      </div>

      {confirming && selected && (
        <ConfirmDialog
          title={`Set ${environmentLabel(selected)} as the Base Environment`}
          message="The base environment stores all reconciliation data and provides the content tree you will track items from. This choice is permanent — it can only be changed by resetting the tool, which deletes all stored reconciliation data."
          confirmLabel="Set as Base Environment"
          onConfirm={() => {
            setConfirming(false);
            onSetup(selected);
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
