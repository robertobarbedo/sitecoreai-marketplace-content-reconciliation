# Data usage disclosure

Content Reconciliation is a client-only app: it runs in your browser inside
SitecoreAI and reads and writes your environments through the Sitecore
Marketplace SDK (Authoring and Management GraphQL API, `master` database)
with your own permissions. It has no backend, no API routes and no database,
and the publisher receives no content. It reads content field values from
several of your environments and copies them between them, always in the
browser. Everything it stores lives in your own SitecoreAI environments under
`/sitecore/system/Modules/Marketplace/ContentReconciliation`. Desired values
are stored as **plain text**: never enter secrets such as API keys,
passwords, tokens or connection strings as desired values.

| Data type | Source | Purpose | Retention | Storage region | Access | Protection | Your rights (DSAR) | Deletion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sitecore content and metadata (item names, paths, IDs, field names, field IDs, field values, languages, versions) | Read from the base environment (tree, fields, languages), from any environment ("Set current values") and from the target environment (Apply preview), via the Marketplace SDK | Browse the tree, track fields, compare current and desired values across environments | Not stored by the app beyond the catalog row below; held in browser memory while the app is open | Your SitecoreAI environments' region; in transit only through your browser | You, within your SitecoreAI permissions | TLS 1.2+ and HSTS; SitecoreAI permissions enforced by Sitecore | Email rb205@proton.me; the publisher keeps no personal data beyond logs | Close the app; nothing is kept |
| Catalog: tracked item IDs, paths and names, tracked field IDs and names, sharedness, desired values per environment and language (plain text, unencrypted) | Entered by you, or copied from an environment's current field value | Restore environment-specific field values after content transfers (Apply writes them to the target environment) | Until you delete it or run Reset | `Data` item under `/sitecore/system/Modules/Marketplace/ContentReconciliation` in the base environment's `master` database, in that environment's region; governed by your Sitecore agreement | Anyone with read access to `/sitecore/system/Modules` in the base environment; included in backups and content transfers | TLS 1.2+ and HSTS in transit; Sitecore's at-rest encryption; no app-level encryption, so do not store secrets | Managed by your organization in SitecoreAI; questions to rb205@proton.me | Reset (type `RESET`) or delete `/sitecore/system/Modules/Marketplace/ContentReconciliation` in the base environment |
| Environment markers (tenant ID, environment name, created time) | SDK application context (`resourceAccess`) | Identify the base environment and detect duplicates after transfers | Until you delete them or run Reset | `Base` / `Secondary` items under `/sitecore/system/Modules/Marketplace/ContentReconciliation` in every environment, in each environment's region | Anyone with read access to `/sitecore/system/Modules` in that environment | TLS 1.2+ and HSTS in transit; Sitecore's at-rest encryption | Managed by your organization in SitecoreAI; questions to rb205@proton.me | Reset, or delete that folder in each environment |
| Context language preference | Selected by you in settings | Remember the language for the tree and base values | One year | Browser cookie `cr_context_language`, on your device | You only | Cookie set `Secure`, sent only over HTTPS | Stays on your device; the publisher has no copy | Clear site data for the app |
| Request metadata (IP address, time, path, user agent) | Your browser loading the app's pages and files | Serve and secure the app | 90 days at most | Vercel (United States, default region `iad1`, Washington, D.C., unless the deployment sets another region; static files from Vercel's edge network) | App maintainer and Vercel | TLS 1.2+ and HSTS; provider encryption at rest; contains no content, tokens or secrets | Email rb205@proton.me; answered within 30 days | Deleted automatically after 90 days at most |

The app has no server-side code, so it writes no audit or application logs.
It uses no analytics, tracking or advertising services, and its fonts are
self-hosted with the app.

## AI usage

This app does not use AI or machine learning.
