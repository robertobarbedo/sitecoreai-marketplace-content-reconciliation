/**
 * Content Reconciliation constants
 */

/**
 * Sitecore database names
 */
export const SITECORE_DATABASES = {
  MASTER: "master",
} as const;

/**
 * Default language used for storage items and shared-field batches
 */
export const DEFAULT_LANGUAGE = "en";

/**
 * Language type definition
 */
export type Language = string;

/**
 * Template and parent IDs (shared with the other marketplace modules)
 */
export const SITECORE_TEMPLATES = {
  MODULE_FOLDER: "{A87A00B1-E6DB-45AB-8B54-636FEC3B5523}",
  SETTINGS_ITEM: "{D2923FEE-DA4E-49BE-830C-E27764DFA269}",
} as const;

export const MODULES_PARENT_ID = "{08477468-D438-43D4-9D6A-6D84A611971C}";

/** Root of the content tree shown in the tracking view (/sitecore). */
export const TREE_ROOT = {
  itemId: "{11111111-1111-1111-1111-111111111111}",
  name: "sitecore",
  path: "/sitecore",
} as const;

/** Item holding the language list. */
export const LANGUAGES_ITEM_PATH = "/sitecore/system/Languages";

/**
 * Content tree paths where this app persists its data
 */
export const STORAGE_PATHS = {
  MARKETPLACE_FOLDER: "/sitecore/system/Modules/Marketplace",
  MODULE_FOLDER: "/sitecore/system/Modules/Marketplace/ContentReconciliation",
  BASE_MARKER: "/sitecore/system/Modules/Marketplace/ContentReconciliation/Base",
  SECONDARY_MARKER:
    "/sitecore/system/Modules/Marketplace/ContentReconciliation/Secondary",
  DATA_ITEM: "/sitecore/system/Modules/Marketplace/ContentReconciliation/Data",
} as const;

export const MARKETPLACE_FOLDER_NAME = "Marketplace";
export const MODULE_FOLDER_NAME = "ContentReconciliation";
export const BASE_MARKER_NAME = "Base";
export const SECONDARY_MARKER_NAME = "Secondary";
export const DATA_ITEM_NAME = "Data";

/**
 * Inner key used in TrackedField.values for shared fields, whose single value
 * applies to every language.
 */
export const SHARED_VALUE_KEY = "*";
