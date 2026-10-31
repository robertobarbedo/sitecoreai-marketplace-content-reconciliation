"use client";

import { Button, Modal } from "./ui";

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p
        style={{
          fontSize: "var(--font-size-sm)",
          marginBottom: "var(--spacing-4)",
          whiteSpace: "pre-wrap",
        }}
      >
        {message}
      </p>
      <div
        style={{
          display: "flex",
          gap: "var(--spacing-2)",
          justifyContent: "flex-end",
        }}
      >
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
