# Content Reconciliation

A SitecoreAI Marketplace app that captures the correct value of
environment-specific fields and restores them after a content transfer
overwrites them.

Moving content between SitecoreAI (XM Cloud) environments copies field values
verbatim. Fields that are meant to differ per environment, such as hostnames,
endpoint URLs, feature toggles or tracking IDs, end up with the source
environment's values, and someone has to find and fix them by hand after every
transfer.

Content Reconciliation turns that into a catalog you define once. You browse
the content tree, mark the items and fields that are environment-specific, and
record the desired value of each field for every environment (per language, or
once for shared fields). After a transfer, you pick a target environment,
review a preview of current versus desired values, and apply only the changes
you confirm.

## Features

- **Base environment** — one environment, chosen on first run, owns the
  catalog and provides the content tree; every other environment is marked as
  secondary.
- **Content tree browsing** — lazy-loaded tree of the base environment's
  master database, rooted at `/sitecore`, with tracked items badged.
- **Item and field tracking** — track an item, then track individual fields
  (or all fields in a tab), split into Content and System fields.
- **Shared-field detection** — when a field is tracked, the app reads its
  field definition to decide whether to store one value or one per language.
- **Per-environment desired values** — one input per environment and language;
  "not set" means skip, an explicit empty value means clear the field.
- **Set current values** — read a field's current value from any environment
  (all languages at once) and use it as the desired value.
- **Preview before apply** — per row: item, field, language, current value,
  desired value and status (will update, unchanged, item missing, no version).
- **Per-field results** — apply reports updated, failed and skipped rows, with
  a retry for failed rows.
- **Explicit saving with conflict detection** — Save button with unsaved-change
  warning; a concurrent save from another session prompts overwrite or reload.
- **Startup checks** — detects missing setup, multiple base environments and
  unreadable stored data, and walks you through each case.
- **Reset** — type-to-confirm removal of all app data from every environment.

## How it works

- **Extension point:** Standalone, served from the root route `/`.
  Standalone apps are organization-wide: the app lists every environment it
  has been granted access to from the SDK's `application.context`
  (`resourceAccess`), using each environment's preview context ID.
- **API:** all reads and writes go through the Authoring and Management
  GraphQL API (`xmc.authoring.graphql`) via the
  [Sitecore Marketplace SDK](https://doc.sitecore.com/mp/en/developers/marketplace/introduction-to-sitecore-marketplace.html),
  against the `master` database. There are no `/api` routes and no server-side
  code; the app is a static client that talks to SitecoreAI through the host.

```
Browser (app iframe) -> Marketplace SDK -> SitecoreAI host
                     -> Authoring GraphQL of each environment (master db)
```

**Storage.** Everything the app stores lives under
`/sitecore/system/Modules/Marketplace/ContentReconciliation`:

| Item | Where | Contents |
| --- | --- | --- |
| `Base` | Base environment | Marker JSON (tenant ID, name, created time) |
| `Secondary` | Every other environment | Marker JSON |
| `Data` | Base environment | The whole catalog as one JSON document |

The `Data` item holds tracked items (by item ID, so they match across
environments), tracked fields (by field ID), and desired values keyed by
environment name and language (`*` for shared fields). Desired values are
stored as plain text: never use them for secrets such as API keys, passwords
or tokens.

**Startup.** The app queries every environment for the `Base` and `Secondary`
markers:

- One base: load the catalog and open the main view.
- No base: show first-run setup. The base choice is permanent unless you
  reset. If some environments could not be checked, setup requires an
  explicit acknowledgement, since one of them may already be the base.
- More than one base (for example, the module folder was copied by a content
  transfer): show a conflict screen. You pick the real base by typing its
  name; the other `Base` markers are deleted and replaced by `Secondary`
  markers. Their stored data is left in place and ignored.
- Unparsable `Data`: show the raw content so you can copy it, with an option
  to discard it and start with an empty catalog.

**Saving.** Edits stay in the browser until you click Save. Before writing, the
app compares the stored catalog's `updatedAt` with the one it loaded; a
mismatch opens an overwrite-or-reload dialog. Environment renames are carried
over on save by matching tenant IDs.

**Apply.**

1. Build one row per stored desired value for the target environment.
2. Group rows by item and language and fetch the item from the target
   environment. Missing items and items with no version in that language are
   skipped; rows whose current value already matches are marked unchanged.
3. After confirmation, re-fetch each item right before writing and send one
   `updateItem` per item and language against its latest version number.

Apply always uses the last saved catalog, never unsaved edits. Shared-field
values are written through the `en` language version.

## Requirements

- A SitecoreAI (XM Cloud) organization with at least one environment.
- An Organization Admin or Owner to create and install the app in App Studio
  and grant it access to environments.
- Users of the app need read access to the content they want to track, and
  write access to:
  - `/sitecore/system/Modules` in every environment the app can access (the
    app creates `Marketplace/ContentReconciliation` there on first run), and
  - the tracked items in each environment you apply to.
- No extra credentials, API keys or third-party services.

## Install in SitecoreAI

1. In the Cloud Portal, open **App Studio** and choose **Create app**.
2. Enter an app name (for example, Content Reconciliation) and select the
   type **Custom**.
3. Add the **Standalone** extension point with the route `/`.
4. Under API access, enable **SitecoreAI APIs**.
5. No additional permissions are needed.
6. Set the deployment URL to `https://<your-deployment>/`.
7. Upload the app logo from [`public/icon.svg`](public/icon.svg).
8. Save, then install the app in your organization and grant it access to the
   environments you want to reconcile.
9. Open the app from the SitecoreAI apps menu. On first run, choose the base
   environment.

## Deploy your own instance

```sh
npm install
npm run build
npm start
```

Deploy to Vercel or any Node.js host that can run Next.js, then set the
deployment URL of your App Studio app to the public HTTPS URL.

| Variable | Required | Description |
| --- | --- | --- |
| `CSP_FRAME_ANCESTORS` | No | Space-separated CSP sources allowed to embed the app in a frame. Default: `'self' https://*.sitecorecloud.io`. |

There are no server-side secrets and no other environment variables. To set
the variable locally, add it to `.env.local`.

The app only runs inside SitecoreAI. The Marketplace SDK needs the host
iframe; opening the deployment URL directly in a browser shows a connection
error. For local development, run `npm run dev`, expose it over HTTPS (for
example with ngrok), and register that URL in a separate development app in
App Studio.

## Configuration

Open the gear icon in the app header:

- **Base environment** — shown read-only. It can only be changed by a reset.
- **Context Language** — the language used for the content tree and the base
  value shown next to each field. The list comes from
  `/sitecore/system/Languages` in the base environment (falls back to `en`).
  The choice is stored in the `cr_context_language` cookie for one year.
- **Reset** — type `RESET` to permanently delete the
  `/sitecore/system/Modules/Marketplace/ContentReconciliation` folder in every
  environment and return to first-run setup. Failed environments can be
  retried.

All other state (tracked items, fields and desired values) is stored in the
`Data` item in the base environment, not in the browser.

## Security and privacy

- **Authentication:** every call runs through the Marketplace SDK with the
  signed-in SitecoreAI user's own session and permissions. The app has no
  login of its own, no backend and no stored credentials.
- **Secrets:** none.
- **Stored data:** desired values are stored as plain text, unencrypted, in
  the `Data` item in the base environment's master database. Anyone who can
  read `/sitecore/system/Modules` in that environment can read them, and the
  item is included in backups, serialization, packages and content transfers
  like any other item. **Never store secrets such as API keys, passwords,
  tokens or connection strings as desired values**; keep those in your
  hosting platform's secret store or environment variables instead. The field
  panel shows the same reminder above the field list.
- **Writes:** the tracking view never edits content. Only Apply writes to
  content items, and only after a confirmation dialog. Setup, Save, conflict
  resolution and Reset write only under the module folder.
- **Data across environments:** the app reads field values from several
  environments and copies them between them, always in your browser through
  the Marketplace SDK. Content tree, field values and languages are read from
  the base environment; "Set current values" reads a field's current value
  from another environment and saves it in the base environment's `Data`
  item; Apply reads the target environment's current values for the preview
  and writes the desired values stored in the base environment to it. The
  `Base`/`Secondary` markers are written to every environment.
- **Data leaving the browser:** content and desired values go only to your
  SitecoreAI environments through the host. The app has no backend, no
  analytics and no third-party services. Fonts are self-hosted with the app
  (bundled at build time), so no request goes to Google Fonts.
- **Security headers:** every response sends HSTS, a `frame-ancestors`
  Content Security Policy (SitecoreAI hosts only, see `CSP_FRAME_ANCESTORS`),
  `X-Content-Type-Options: nosniff`, a strict `Referrer-Policy` and a
  `Permissions-Policy` that disables camera, microphone, geolocation, payment
  and USB.
- **Host restrictions:** the app makes no outbound requests to user-supplied
  URLs.
- **Policies:** [Privacy policy](PRIVACY.md),
  [Terms of service](TERMS.md),
  [Data usage disclosure](DATA-USAGE.md) and
  [Security policy](SECURITY.md).

## Limitations

- One catalog per organization, owned by a single base environment. Changing
  the base environment requires a reset, which deletes all stored data.
- The content tree, field list and language list come from the base
  environment. Items are matched across environments by item ID; items that
  only exist in other environments cannot be tracked.
- Shared fields are applied through the `en` version. An item with no `en`
  version in the target environment is skipped as "no version".
- Desired values are raw field values in plain text. Complex fields (links,
  images, rich text) must be entered in their raw stored format.
- Apply writes to the master database only. Publish the changed items
  afterwards.
- Apply does not create missing items or language versions; it skips them.
- Values stored for an environment the app can no longer access are kept and
  shown as values for an unknown environment, which you can delete per field.

## Development

- Next.js 15 (App Router), React 19, TypeScript.
- Sitecore Marketplace SDK (`@sitecore-marketplace-sdk/client` 0.4 and
  `@sitecore-marketplace-sdk/xmc` 0.4).
- Inter and JetBrains Mono, self-hosted through `next/font/google`.
- No component library: plain React with inline styles and CSS variables
  defined in `src/app/globals.css`, with shared primitives in
  `src/components/ui.tsx`.
- `npm run dev` starts the Next.js dev server on the default port 3000.

```
src/
  app/          Root layout, global styles and the single page (/)
  components/   Tree, field panel, apply view, setup/conflict/reset screens
  context/      App state (catalog reducer, save and reload)
  types/        Catalog data model
  utils/        GraphQL helpers, storage, environments, SDK hook
public/         App icon
```

## Support

Report bugs and request features by opening an issue at
https://github.com/robertobarbedo/sitecoreai-marketplace-content-reconciliation/issues.
To report a vulnerability, follow the [Security policy](SECURITY.md). For
privacy and data requests, see the [Privacy policy](PRIVACY.md) and the
[Data usage disclosure](DATA-USAGE.md); use of the app is subject to the
[Terms of service](TERMS.md).

This is a community app and is not an official Sitecore product.

## License

Licensed under the Apache License 2.0 — see [LICENSE](LICENSE).
