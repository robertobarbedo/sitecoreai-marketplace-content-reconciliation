"use client";

import { useCallback, useEffect, useState } from "react";
import type { ClientSDK } from "@sitecore-marketplace-sdk/client";
import { TREE_ROOT } from "@/src/constants";
import { getChildren, type ChildNode } from "@/src/utils/sitecore-graphql";
import {
  Icon,
  mdiChevronDown,
  mdiChevronRight,
  mdiFileDocumentOutline,
  mdiLoading,
} from "./Icon";

export interface TreeSelection {
  itemId: string;
  name: string;
  path: string;
}

const ROOT_NODE: ChildNode = {
  itemId: TREE_ROOT.itemId,
  name: TREE_ROOT.name,
  path: TREE_ROOT.path,
  hasChildren: true,
};

/**
 * Lazy content tree of the base environment, rooted at /sitecore. The row
 * styling mirrors the transfer console's tree picker (chevron button, file
 * icon, filled selected row). Tracked items get a badge so users can see at
 * a glance what is already under reconciliation.
 */
export function ContentTree({
  client,
  contextId,
  language,
  trackedIds,
  selectedId,
  onSelect,
}: {
  client: ClientSDK;
  contextId: string;
  language: string;
  trackedIds: Set<string>;
  selectedId: string | null;
  onSelect: (selection: TreeSelection) => void;
}) {
  const [childrenById, setChildrenById] = useState<Record<string, ChildNode[]>>({});
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set([ROOT_NODE.itemId]),
  );
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const loadChildren = useCallback(
    async (itemId: string) => {
      setLoadingIds((prev) => new Set(prev).add(itemId));
      setError(null);
      try {
        const children = await getChildren(client, contextId, itemId, language);
        setChildrenById((prev) => ({ ...prev, [itemId]: children }));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoadingIds((prev) => {
          const next = new Set(prev);
          next.delete(itemId);
          return next;
        });
      }
    },
    [client, contextId, language],
  );

  // Language switch invalidates the cache (item availability differs).
  useEffect(() => {
    setChildrenById({});
    setExpandedIds(new Set([ROOT_NODE.itemId]));
    loadChildren(ROOT_NODE.itemId);
  }, [loadChildren]);

  const handleToggle = (node: ChildNode) => {
    if (!node.hasChildren) return;
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(node.itemId)) {
        next.delete(node.itemId);
      } else {
        next.add(node.itemId);
        if (!childrenById[node.itemId]) {
          loadChildren(node.itemId);
        }
      }
      return next;
    });
  };

  const renderNode = (node: ChildNode, depth: number) => {
    const expanded = expandedIds.has(node.itemId);
    const loading = loadingIds.has(node.itemId);
    const children = childrenById[node.itemId];
    const isSelected = selectedId === node.itemId;
    const isTracked = trackedIds.has(node.itemId);

    return (
      <div key={node.itemId}>
        <div
          className={`tree-row${isSelected ? " tree-row-selected" : ""}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--spacing-1)",
            padding: "var(--spacing-1-5) var(--spacing-2) var(--spacing-1-5) 0",
            paddingLeft: depth * 16 + 4,
            borderRadius: "var(--radius-lg)",
            background: isSelected ? "var(--color-background)" : undefined,
            border: isSelected
              ? "1px solid var(--color-primary)"
              : "1px solid transparent",
            color: "var(--color-foreground)",
          }}
        >
          <button
            type="button"
            onClick={() => handleToggle(node)}
            aria-label={expanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 20,
              height: 20,
              flexShrink: 0,
              border: "none",
              background: "none",
              padding: 0,
              borderRadius: "var(--radius-sm)",
              cursor: node.hasChildren ? "pointer" : "default",
              visibility: node.hasChildren ? "visible" : "hidden",
              color: "var(--color-muted-foreground)",
            }}
          >
            <Icon
              path={loading ? mdiLoading : expanded ? mdiChevronDown : mdiChevronRight}
              spin={loading}
            />
          </button>
          <button
            type="button"
            onClick={() =>
              onSelect({ itemId: node.itemId, name: node.name, path: node.path })
            }
            onDoubleClick={() => handleToggle(node)}
            title={node.path}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--spacing-1-5)",
              minWidth: 0,
              border: "none",
              background: "none",
              padding: 0,
              cursor: "pointer",
              textAlign: "left",
              color: "inherit",
              font: "inherit",
            }}
          >
            <Icon path={mdiFileDocumentOutline} style={{ opacity: 0.75 }} />
            <span
              style={{
                fontSize: "var(--font-size-sm)",
                fontWeight: isSelected ? 600 : 400,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {node.name}
            </span>
          </button>
          {isTracked && (
            <span
              title="Tracked for reconciliation"
              style={{
                fontSize: "var(--font-size-3xs)",
                background: "var(--color-primary-soft)",
                color: "var(--color-primary-soft-foreground)",
                borderRadius: "var(--radius-md)",
                padding: "var(--spacing-0-5) var(--spacing-1-5)",
                fontWeight: 600,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                flexShrink: 0,
              }}
            >
              tracked
            </span>
          )}
        </div>

        {expanded &&
          children &&
          (children.length === 0 ? (
            <p
              style={{
                padding: `var(--spacing-1) 0 var(--spacing-1) ${(depth + 1) * 16 + 28}px`,
                fontSize: "var(--font-size-xs)",
                color: "var(--color-muted-foreground)",
              }}
            >
              No children
            </p>
          ) : (
            children.map((child) => renderNode(child, depth + 1))
          ))}
      </div>
    );
  };

  return (
    <div style={{ overflowY: "auto", height: "100%", padding: "var(--spacing-2)" }}>
      {error && (
        <div
          style={{
            color: "var(--color-danger)",
            fontSize: "var(--font-size-xs)",
            padding: "var(--spacing-2)",
          }}
        >
          Failed to load tree: {error}
        </div>
      )}
      {renderNode(ROOT_NODE, 0)}
    </div>
  );
}
