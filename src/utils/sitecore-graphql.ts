import type { ClientSDK } from "@sitecore-marketplace-sdk/client";
import {
  SITECORE_DATABASES,
  DEFAULT_LANGUAGE,
  LANGUAGES_ITEM_PATH,
  type Language,
} from "@/src/constants";

export interface FieldNode {
  name: string;
  fieldId?: string;
  value: string;
}

export interface SitecoreItem {
  itemId: string;
  name: string;
  path: string;
  fields?: { nodes: FieldNode[] };
}

export interface ItemWithFields extends SitecoreItem {
  version?: number;
  versions?: { version: number }[];
}

export interface ChildNode {
  itemId: string;
  name: string;
  path: string;
  hasChildren: boolean;
}

/**
 * Users type arbitrary desired values (multi-line, quotes, tabs), so unlike
 * the sibling apps — which only ever escape JSON.stringify output — control
 * characters must be escaped too.
 */
export function escapeGraphQL(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

/**
 * Runs an authoring GraphQL document against the environment identified by
 * `sitecoreContextId`. Throws when the response carries GraphQL errors.
 */
async function runAuthoring<T>(
  client: ClientSDK,
  sitecoreContextId: string,
  query: string,
): Promise<T> {
  const response = await client.mutate("xmc.authoring.graphql", {
    params: {
      query: { sitecoreContextId },
      body: { query },
    },
  });

  const payload = (
    response as Record<string, unknown> & {
      data?: { data?: T; errors?: { message?: string }[] };
    }
  ).data;

  if (payload?.errors?.length) {
    throw new Error(
      payload.errors
        .map((e) => e.message ?? "Unknown GraphQL error")
        .join("; "),
    );
  }
  if (payload?.data === undefined || payload?.data === null) {
    throw new Error("Empty GraphQL response");
  }
  return payload.data;
}

export async function queryItemByPath(
  client: ClientSDK,
  sitecoreContextId: string,
  path: string,
  language: Language = DEFAULT_LANGUAGE,
): Promise<SitecoreItem | null> {
  const data = await runAuthoring<{ item: SitecoreItem | null }>(
    client,
    sitecoreContextId,
    `
      query {
        item(where: { database: "${SITECORE_DATABASES.MASTER}", path: "${escapeGraphQL(path)}", language: "${escapeGraphQL(language)}" }) {
          itemId
          name
          path
          fields(ownFields: true, excludeStandardFields: true) {
            nodes { name value }
          }
        }
      }
    `,
  );
  return data.item ?? null;
}

export async function createItem(
  client: ClientSDK,
  sitecoreContextId: string,
  parentId: string,
  templateId: string,
  itemName: string,
  language: Language = DEFAULT_LANGUAGE,
): Promise<SitecoreItem | null> {
  const data = await runAuthoring<{
    createItem: { item: SitecoreItem | null } | null;
  }>(
    client,
    sitecoreContextId,
    `
      mutation {
        createItem(input: {
          database: "${SITECORE_DATABASES.MASTER}"
          name: "${escapeGraphQL(itemName)}"
          parent: "${escapeGraphQL(parentId)}"
          templateId: "${escapeGraphQL(templateId)}"
          language: "${escapeGraphQL(language)}"
        }) {
          item {
            itemId
            name
            path
            fields(ownFields: true, excludeStandardFields: true) {
              nodes { name value }
            }
          }
        }
      }
    `,
  );
  return data.createItem?.item ?? null;
}

export async function updateItemField(
  client: ClientSDK,
  sitecoreContextId: string,
  itemId: string,
  itemPath: string,
  fieldName: string,
  fieldValue: string,
  language: Language = DEFAULT_LANGUAGE,
  version: number = 1,
): Promise<SitecoreItem | null> {
  return updateItemFields(
    client,
    sitecoreContextId,
    itemId,
    itemPath,
    [{ name: fieldName, value: fieldValue }],
    language,
    version,
  );
}

/** Batched updateItem — one mutation per item per language. */
export async function updateItemFields(
  client: ClientSDK,
  sitecoreContextId: string,
  itemId: string,
  itemPath: string,
  fields: { name: string; value: string }[],
  language: Language = DEFAULT_LANGUAGE,
  version: number = 1,
): Promise<SitecoreItem | null> {
  const fieldEntries = fields
    .map(
      (f) => `
        {
          name: "${escapeGraphQL(f.name)}",
          value: "${escapeGraphQL(f.value)}",
          reset: false
        }`,
    )
    .join(",");

  const data = await runAuthoring<{
    updateItem: { item: SitecoreItem | null } | null;
  }>(
    client,
    sitecoreContextId,
    `
      mutation {
        updateItem(input: {
          fields: [${fieldEntries}]
          database: "${SITECORE_DATABASES.MASTER}"
          itemId: "${escapeGraphQL(itemId)}"
          language: "${escapeGraphQL(language)}"
          path: "${escapeGraphQL(itemPath)}"
          version: ${version}
        }) {
          item {
            name
            itemId
            fields(ownFields: true, excludeStandardFields: true) {
              nodes { name value }
            }
          }
        }
      }
    `,
  );
  return data.updateItem?.item ?? null;
}

export async function updateItemFieldByPath(
  client: ClientSDK,
  sitecoreContextId: string,
  itemPath: string,
  fieldName: string,
  fieldValue: string,
  language: Language = DEFAULT_LANGUAGE,
): Promise<SitecoreItem | null> {
  const item = await queryItemByPath(
    client,
    sitecoreContextId,
    itemPath,
    language,
  );
  if (!item) {
    return null;
  }
  return await updateItemField(
    client,
    sitecoreContextId,
    item.itemId,
    itemPath,
    fieldName,
    fieldValue,
    language,
    1,
  );
}

export async function deleteItem(
  client: ClientSDK,
  sitecoreContextId: string,
  itemId: string,
): Promise<boolean> {
  const data = await runAuthoring<{
    deleteItem: { successful: boolean } | null;
  }>(
    client,
    sitecoreContextId,
    `
      mutation {
        deleteItem(input: {
          database: "${SITECORE_DATABASES.MASTER}"
          itemId: "${escapeGraphQL(itemId)}"
          permanently: true
        }) {
          successful
        }
      }
    `,
  );
  return data.deleteItem?.successful ?? false;
}

/**
 * Full item read used by the field panel (base env) and the Apply
 * current-value fetch (target env): every field plus the version list of the
 * requested language.
 */
export async function getItemWithFields(
  client: ClientSDK,
  sitecoreContextId: string,
  itemId: string,
  language: Language = DEFAULT_LANGUAGE,
): Promise<ItemWithFields | null> {
  const data = await runAuthoring<{ item: ItemWithFields | null }>(
    client,
    sitecoreContextId,
    `
      query {
        item(where: { database: "${SITECORE_DATABASES.MASTER}", itemId: "${escapeGraphQL(itemId)}", language: "${escapeGraphQL(language)}" }) {
          itemId
          name
          path
          version
          versions {
            version
          }
          fields(ownFields: false, excludeStandardFields: false) {
            nodes { name fieldId value }
          }
        }
      }
    `,
  );
  return data.item ?? null;
}

/**
 * Current value of one field on an item, fetched for several languages in a
 * single aliased query against one environment. A language maps to null when
 * the item is missing there, has no version in that language, or doesn't
 * have the field — callers should skip those instead of storing a value.
 */
export async function getFieldValuePerLanguage(
  client: ClientSDK,
  sitecoreContextId: string,
  itemId: string,
  fieldName: string,
  languages: string[],
): Promise<Record<string, string | null>> {
  const aliases = languages
    .map(
      (lang, i) => `
        l${i}: item(where: { database: "${SITECORE_DATABASES.MASTER}", itemId: "${escapeGraphQL(itemId)}", language: "${escapeGraphQL(lang)}" }) {
          versions { version }
          field(name: "${escapeGraphQL(fieldName)}") { value }
        }`,
    )
    .join("\n");
  const data = await runAuthoring<
    Record<
      string,
      | { versions?: { version: number }[]; field: { value: string } | null }
      | null
    >
  >(client, sitecoreContextId, `query {\n${aliases}\n}`);

  const result: Record<string, string | null> = {};
  languages.forEach((lang, i) => {
    const node = data[`l${i}`];
    result[lang] =
      node && (node.versions?.length ?? 0) > 0 && node.field
        ? node.field.value
        : null;
  });
  return result;
}

/** Lazy tree loading: the direct children of an item. */
export async function getChildren(
  client: ClientSDK,
  sitecoreContextId: string,
  itemId: string,
  language: Language = DEFAULT_LANGUAGE,
): Promise<ChildNode[]> {
  const data = await runAuthoring<{
    item: { children: { nodes: ChildNode[] } | null } | null;
  }>(
    client,
    sitecoreContextId,
    `
      query {
        item(where: { database: "${SITECORE_DATABASES.MASTER}", itemId: "${escapeGraphQL(itemId)}", language: "${escapeGraphQL(language)}" }) {
          children {
            nodes {
              itemId
              name
              path
              hasChildren
            }
          }
        }
      }
    `,
  );
  return data.item?.children?.nodes ?? [];
}

/** Language names defined in the environment (/sitecore/system/Languages). */
export async function getLanguages(
  client: ClientSDK,
  sitecoreContextId: string,
): Promise<string[]> {
  const data = await runAuthoring<{
    item: { children: { nodes: { name: string }[] } | null } | null;
  }>(
    client,
    sitecoreContextId,
    `
      query {
        item(where: { database: "${SITECORE_DATABASES.MASTER}", path: "${LANGUAGES_ITEM_PATH}", language: "${DEFAULT_LANGUAGE}" }) {
          children {
            nodes { name }
          }
        }
      }
    `,
  );
  return (data.item?.children?.nodes ?? []).map((n) => n.name);
}

/**
 * Reads the `Shared` checkbox of a field-definition item ("1" = shared).
 * Returns null when the definition item cannot be resolved — callers should
 * fall back to non-shared and surface a notice.
 */
export async function getFieldSharedness(
  client: ClientSDK,
  sitecoreContextId: string,
  fieldId: string,
): Promise<boolean | null> {
  const data = await runAuthoring<{
    item: { field: { value: string } | null } | null;
  }>(
    client,
    sitecoreContextId,
    `
      query {
        item(where: { database: "${SITECORE_DATABASES.MASTER}", itemId: "${escapeGraphQL(fieldId)}", language: "${DEFAULT_LANGUAGE}" }) {
          field(name: "Shared") {
            value
          }
        }
      }
    `,
  );
  if (!data.item) return null;
  return data.item.field?.value === "1";
}
