"use client";

import { useState } from "react";
import type {
  EnvironmentInfo,
  MarkerData,
} from "@/src/types/reconciliation";
import { environmentLabel } from "@/src/utils/environments";
import { Banner, Button, Spinner, TextInput } from "./ui";

/**
 * Shown when more than one environment holds a Base marker. The user picks
 * the true base; stray Base markers elsewhere are replaced with Secondary
 * markers.
 */
export function ConflictScreen({
  candidates,
  busy,
  error,
  onResolve,
}: {
  candidates: { env: EnvironmentInfo; marker: MarkerData | null }[];
  busy: boolean;
  error: string | null;
  onResolve: (chosen: EnvironmentInfo) => void;
}) {
  const [selected, setSelected] = useState<EnvironmentInfo | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const confirmed =
    selected !== null && confirmText.trim() === selected.tenantName;

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
        Base Environment Conflict
      </h3>
      <Banner tone="danger">
        More than one environment holds a Base marker. This can happen if
        setup ran while an environment was unreachable, or if reconciliation
        items were copied by a content transfer. Pick the environment that
        actually holds your reconciliation data — the tracked data stored in
        the other environments will stay in place but will be ignored, and
        their Base markers will be replaced with Secondary markers.
      </Banner>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--spacing-2)",
          margin: "var(--spacing-4) 0",
        }}
      >
        {candidates.map(({ env, marker }) => (
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
              name="conflict-base-env"
              checked={selected?.tenantId === env.tenantId}
              onChange={() => {
                setSelected(env);
                setConfirmText("");
              }}
            />
            <div>
              <div style={{ fontWeight: 600 }}>{environmentLabel(env)}</div>
              <div
                style={{
                  fontSize: "var(--font-size-xs)",
                  color: "var(--color-muted-foreground)",
                }}
              >
                {env.tenantName}
                {marker?.createdAt
                  ? ` — marker created ${new Date(marker.createdAt).toLocaleString()}`
                  : " — marker has no metadata"}
                {marker && marker.tenantName !== env.tenantName
                  ? ` (marker originally created for "${marker.tenantName}" — likely copied here by a transfer)`
                  : ""}
              </div>
            </div>
          </label>
        ))}
      </div>

      {selected && (
        <div style={{ marginBottom: "var(--spacing-4)" }}>
          <p style={{ fontSize: "var(--font-size-sm)", marginBottom: "var(--spacing-2)" }}>
            Type <code>{selected.tenantName}</code> to confirm:
          </p>
          <TextInput
            value={confirmText}
            onChange={setConfirmText}
            placeholder={selected.tenantName}
          />
        </div>
      )}

      {error && <Banner tone="danger">Conflict resolution failed: {error}</Banner>}

      <div style={{ display: "flex", gap: "var(--spacing-3)", alignItems: "center" }}>
        <Button
          variant="primary"
          disabled={!confirmed || busy}
          onClick={() => selected && onResolve(selected)}
        >
          Keep as Base Environment
        </Button>
        {busy && <Spinner label="Resolving conflict…" />}
      </div>
    </div>
  );
}
