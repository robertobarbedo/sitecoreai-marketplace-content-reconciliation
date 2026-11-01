# Marketplace submission: Content Reconciliation

Copy-paste text for Sitecore's public-app submission form, in form order.
Replace `{{APP_URL}}` with the production deployment URL before submitting.

## 1. App name

Content Reconciliation

## 2. Headline

<!-- 382 chars -->

Stop fixing environment-specific fields by hand after every content transfer. Mark the SitecoreAI items and fields that must differ per environment, such as hostnames, endpoint URLs, feature toggles or tracking IDs, record the desired value for each environment and language, then preview current versus desired values on a target environment and apply only the changes you confirm.

## 3. Description

Moving content between SitecoreAI environments copies field values verbatim. Fields that are meant to differ per environment, such as hostnames, endpoint URLs, feature toggles or tracking IDs, end up with the source environment's values, and someone has to find and fix them by hand after every transfer. Content Reconciliation turns that into a catalog you define once.

Key features:
- Base environment: one environment, chosen on first run, owns the catalog and provides the content tree
- Content tree browsing of the base environment, with tracked items badged
- Track items, then individual fields (or all fields in a tab), split into Content and System fields
- Shared-field detection: stores one value for shared fields or one per language otherwise
- Per-environment desired values: "not set" means skip, an explicit empty value means clear the field
- Set current values: read a field's value from any environment, in all languages at once, and use it as the desired value
- Preview before apply: item, field, language, current value, desired value and status (will update, unchanged, item missing, no version)
- Per-field results with retry for failed rows
- Explicit saving with conflict detection when another session saved in the meantime
- Startup checks for missing setup, multiple base environments and unreadable data
- Type-to-confirm reset that removes all app data from every environment

Use cases:
- Restore production hostnames and API endpoints after copying content down from or up to another environment
- Keep feature toggles and tracking IDs correct per environment
- Document which fields are environment-specific in one place

Works together with Content Transfer Console, which can apply the catalog automatically at the end of a saved transfer. Every call runs with the signed-in user's own SitecoreAI permissions; the app needs no credentials.

## 4. Financial model

Free

## 5. Categories

Suggested (match to the portal's category list before submitting):
- Content management
- Developer tools

## 6. Screenshots to capture

PNG, shown as 600×900 thumbnails. Capture during live QA with two or more environments.

1. Main view: content tree with tracked items badged and the field panel open with desired values per environment.
2. Field list for an item showing Content / System fields and tracked fields.
3. Apply preview for a target environment with will update / unchanged / missing statuses.
4. Apply results with updated, failed and skipped rows.
5. First-run setup choosing the base environment.

## 7. Links

- Website: https://github.com/robertobarbedo/sitecoreai-marketplace-content-reconciliation
- Support: https://github.com/robertobarbedo/sitecoreai-marketplace-content-reconciliation/issues
- Privacy policy: https://github.com/robertobarbedo/sitecoreai-marketplace-content-reconciliation/blob/main/PRIVACY.md
- Terms of service: https://github.com/robertobarbedo/sitecoreai-marketplace-content-reconciliation/blob/main/TERMS.md

## 8. Data usage disclosure

Paste from `DATA-USAGE.md`.

Summary: the app is client-side only. Content, field values and the catalog travel only between the browser and the customer's SitecoreAI environments through the Marketplace SDK, with the user's own permissions; nothing reaches the app's server. The catalog (tracked items, fields and desired values, as plain text) is stored in one item in the base environment and marker items in every environment; the context language is kept in a cookie, and the hosting provider keeps request logs for at most 90 days.

## 9. AI usage disclosure switch

Off. The app does not use AI or machine learning.

## 10. Configuration tab

- Extension point: **Standalone**, route `/`.
- API access: **SitecoreAI APIs** (the app calls `xmc.authoring.graphql` through the Marketplace SDK for every environment in `application.context`).
- Permissions: none (the code doesn't use pop-ups, the clipboard or file downloads).
- Deployment URL: `{{APP_URL}}`
- Client credentials (custom authorization): **No**. The app has no `/api` routes and uses only the Marketplace SDK's built-in authorization.
- Environment variables on the host: none required. Optional: `CSP_FRAME_ANCESTORS`.
- App logo: `public/icon.svg`
- Grant the app access to every environment you want to reconcile.

## 11. Submission details (visible only to Sitecore)

- Contact name: `Roberto Barbedo`
- Contact email: `rb205@proton.me`

**App functionality**

Content Reconciliation is a client-side Next.js 15 app on the Standalone extension point, with built-in Marketplace authorization only; there are no API routes or server-side code. It lists every environment the app has access to from `application.context` (`resourceAccess`) and calls each environment's Authoring and Management GraphQL API (`xmc.authoring.graphql`, master database) through the Marketplace SDK. The catalog (tracked item IDs, field IDs and desired values per environment and language) is stored as one JSON document in a `Data` item, with `Base`/`Secondary` marker items, under `/sitecore/system/Modules/Marketplace/ContentReconciliation`. Apply builds a preview from the target environment's current values, re-fetches each item right before writing, and sends one `updateItem` per item and language against the latest version. The only browser storage is the context-language cookie.

**Business value / alignment with Sitecore standards**

The app removes a repetitive, error-prone manual step after every content transfer between environments and makes environment-specific configuration explicit and reviewable. It uses only supported Marketplace SDK APIs, and every read and write runs with the signed-in user's own permissions; tracking never edits content, and Apply writes only after a preview and confirmation. The UI reproduces the Blok design language with CSS variables (per the shared Marketplace style guide). Security measures: no secrets, credentials or API routes; optimistic-concurrency check on save; type-to-confirm reset; an in-app reminder never to store secrets as desired values (they are stored as plain text); and security headers on every response (HSTS, CSP frame-ancestors limited to SitecoreAI, X-Content-Type-Options, Referrer-Policy, Permissions-Policy). Fonts are self-hosted; no analytics or third-party requests.

**Licensing note**

Next.js lists sharp (LGPL-3.0 libvips) as an optional dependency for image optimization; this app doesn't use next/image and sets images.unoptimized, so sharp is never loaded. The app uses plain CSS and does not depend on Tailwind CSS or lightningcss at all.

## 12. Pre-submit checklist

- [ ] Live QA with at least two environments: first-run setup, track items and fields, set current values, save
- [ ] Live QA: apply preview and apply on a target environment, retry of failed rows
- [ ] Live QA: concurrent-save conflict dialog, multiple-base conflict screen, reset
- [ ] Live QA: the Content Transfer Console Reconciliation tab reads this app's catalog
- [ ] Screenshots captured (PNG), with no real hostnames or IDs visible
- [ ] `{{APP_URL}}` replaced with the production deployment URL in this form
