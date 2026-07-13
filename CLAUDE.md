# Content Reconciliation — notes for Claude Code

## Do NOT run or test this app standalone

SitecoreAI Marketplace apps **cannot run as standalone web apps**. The
Marketplace SDK (`ClientSDK.init({ target: window.parent })`) requires the app
to be embedded in an iframe inside SitecoreAI — outside of it, initialization
hangs/fails and every page is non-functional.

Therefore: **do not start the dev server, open the app in a browser, or
attempt runtime testing.** Verification is limited to:

- `npm run build` (type-check + compile) must pass
- Manual testing happens only inside SitecoreAI after the app is registered
  in Developer Studio (**standalone** extension point → the root route `/`)

## What this app does

After a content transfer between XM Cloud environments, environment-specific
field values get overwritten with the source environment's values. This tool
lets users browse the content tree of a chosen **base environment**, track
items/fields for reconciliation, capture the desired value of each tracked
field **per environment** (per language, unless the field is shared), and
later **apply** the stored values to any environment via authoring GraphQL.
The tracking UI never edits live content — only the Apply tab writes to real
items.

## Project facts

- Based on the marketplace starter kit; only the **standalone** extension
  point is used, served from `src/app/page.tsx`. Standalone apps are
  **global** (not per tenant): `getEnvironments()` (utils/environments.ts)
  maps `application.context.resourceAccess` to the environment list;
  `context.preview` is the `sitecoreContextId` for `xmc.authoring.graphql`.
- All sibling folders under `C:\Marketplace` are reference material only —
  never modify them. Storage/GraphQL patterns mirror
  `sitecoreai-marketplace-content-transfer-api-console`; the content tree is
  adapted from `sitecoreai-marketplace-content-publish-inspector`.
- **Storage model**: everything lives under
  `/sitecore/system/Modules/Marketplace/ContentReconciliation` (master db,
  language `en`, shared module-folder/settings template GUIDs in
  `src/constants.ts`):
  - A `Base` marker item in the base environment and a `Secondary` marker in
    every other environment identify which environment owns the data. On
    load the app queries all environments for markers: one Base → ready,
    zero → first-run setup (base choice is permanent), multiple → conflict
    resolution screen.
  - A single `Data` item in the **base** environment holds the whole
    dataset as one JSON blob in its `Value` field
    (`ReconciliationData` in `src/types/reconciliation.ts`). Desired values
    are keyed `values[tenantName][language]`, with the inner key `"*"`
    (`SHARED_VALUE_KEY`) for shared fields. A missing inner key means "no
    desired value" (Apply skips it); an empty string means "clear the field".
- **Sharedness** of a field is determined lazily when the user first tracks
  it, by reading the `Shared` field of the field-definition item
  (id = `fieldId` from the fields query), then cached in the blob.
- **Saving** is explicit (Save button + dirty dot) with an optimistic
  concurrency check on the blob's `updatedAt`; conflicts offer
  overwrite/reload. Tenant renames are migrated on save by tenantId matching
  (`migrateTenantNames` in AppStateContext).
- **Apply** never trusts stale versions: it re-fetches the target item (and
  its `versions` list) right before each `updateItem` batch and passes
  `max(version)` — never hardcode `version: 1` for content items (the
  settings/marker items do use version 1, which is fine). Items missing in
  the target env or without a version in the batch language are skipped with
  explicit statuses.
- **Reset** (type `RESET`) permanently deletes the ContentReconciliation
  folder in every environment and returns to setup.
- `escapeGraphQL` in `src/utils/sitecore-graphql.ts` also escapes
  `\n`/`\r`/`\t` because users type arbitrary desired values — keep that if
  copying updates from sibling apps (theirs only escape `\` and `"`).
- UI: no component library — plain React with inline styles + CSS variables
  from `src/app/globals.css` (copied from the publish inspector) and shared
  primitives in `src/components/ui.tsx`.
