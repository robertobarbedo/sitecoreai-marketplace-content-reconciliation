"use client";

import type { CSSProperties, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "dark";

const buttonStyles: Record<ButtonVariant, CSSProperties> = {
  primary: {
    background: "var(--color-primary)",
    color: "var(--color-primary-foreground)",
    border: "1px solid var(--color-primary)",
  },
  secondary: {
    background: "var(--color-secondary)",
    color: "var(--color-secondary-foreground)",
    border: "1px solid var(--color-border)",
  },
  danger: {
    background: "var(--color-danger)",
    color: "var(--color-danger-foreground)",
    border: "1px solid var(--color-danger)",
  },
  dark: {
    background: "var(--color-dark)",
    color: "var(--color-dark-foreground)",
    border: "1px solid var(--color-dark)",
  },
};

export function Button({
  variant = "secondary",
  disabled,
  onClick,
  children,
  style,
  title,
}: {
  variant?: ButtonVariant;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
  style?: CSSProperties;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        ...buttonStyles[variant],
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--spacing-1-5)",
        padding: "var(--spacing-2) var(--spacing-4)",
        borderRadius: "var(--radius-lg)",
        fontSize: "var(--font-size-sm)",
        fontWeight: "var(--font-weight-semibold)" as CSSProperties["fontWeight"],
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function Modal({
  title,
  children,
  onClose,
  width = 520,
}: {
  title: string;
  children: ReactNode;
  onClose?: () => void;
  width?: number;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--color-background)",
          borderRadius: "var(--card-radius)",
          padding: "var(--spacing-6)",
          width,
          maxWidth: "90vw",
          maxHeight: "85vh",
          overflowY: "auto",
          boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h4
          style={{
            fontSize: "var(--font-size-lg)",
            marginBottom: "var(--spacing-4)",
          }}
        >
          {title}
        </h4>
        {children}
      </div>
    </div>
  );
}

export function Banner({
  tone,
  children,
}: {
  tone: "warning" | "danger" | "info" | "success";
  children: ReactNode;
}) {
  const colors = {
    warning: "var(--color-warning)",
    danger: "var(--color-danger)",
    info: "var(--color-info)",
    success: "var(--color-success)",
  } as const;
  return (
    <div
      style={{
        border: `1px solid ${colors[tone]}`,
        borderLeft: `4px solid ${colors[tone]}`,
        borderRadius: "var(--radius-md)",
        padding: "var(--spacing-2) var(--spacing-3)",
        fontSize: "var(--font-size-sm)",
        marginBottom: "var(--spacing-3)",
        background: "var(--color-background)",
      }}
    >
      {children}
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  style,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  style?: CSSProperties;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        padding: "var(--spacing-1-5) var(--spacing-2)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
        fontSize: "var(--font-size-sm)",
        width: "100%",
        ...style,
      }}
    />
  );
}

export function Toast({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      style={{
        position: "fixed",
        bottom: "var(--spacing-6)",
        right: "var(--spacing-6)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        gap: "var(--spacing-2)",
        background: "var(--color-background)",
        border: "1px solid var(--color-border)",
        borderLeft: "4px solid var(--color-success)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--spacing-3) var(--spacing-4)",
        boxShadow: "0 6px 24px rgba(16, 18, 27, 0.14)",
        fontSize: "var(--font-size-sm)",
        fontWeight: 600,
      }}
    >
      <span style={{ color: "var(--color-success)" }}>✓</span>
      {children}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span
      style={{
        color: "var(--color-muted-foreground)",
        fontSize: "var(--font-size-sm)",
      }}
    >
      {label ?? "Loading…"}
    </span>
  );
}
