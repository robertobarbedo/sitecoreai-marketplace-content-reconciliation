# Privacy Policy

**Last updated: 2026-10-31**

## Overview

This policy explains what data the Content Reconciliation app ("the app")
handles, where it goes, what is stored, and how you can exercise your
rights. It applies to the hosted app listed in the Sitecore Marketplace.

## Summary

- The app is a client-only web page. It has no backend, no API routes and
  no database, and the publisher's servers receive no Sitecore content,
  field values or credentials.
- The app uses no analytics, tracking or advertising services, and fonts
  are served with the app itself (no request to Google Fonts).
- Everything the app stores lives in your own SitecoreAI environments,
  under `/sitecore/system/Modules/Marketplace/ContentReconciliation`.
- The desired values you enter are stored there **as plain text**. Do not
  enter secrets such as API keys, passwords, tokens or connection strings.
- The only data the publisher's hosting sees is standard request metadata
  for loading the app's pages and files.

## How the app works

The app runs inside SitecoreAI. All reads and writes go from your browser
through the Sitecore Marketplace SDK to the Sitecore Authoring and
Management GraphQL API (`master` database) of each environment the app has
been granted access to, using your own SitecoreAI session and permissions.
The app's hosting only serves the static page and its files; it is not part
of any data flow.

## What data the app handles

- **Sitecore content and metadata** (item names, paths and IDs, field names,
  field IDs and field values, languages, versions): read from your
  environments and shown in your browser.
- **Desired values** you enter or copy for each tracked field, environment
  and language.
- **Environment list** (environment/tenant IDs, names, display names and
  context IDs) from the SDK's application context.
- **Preference**: the selected context language, in a browser cookie.

The app does not read or store your name, email address or other account
details.

## Where data goes

All of the following happens in your browser, through the Marketplace SDK
and the SitecoreAI host. Nothing passes through the publisher's servers.

1. **Base environment.** The content tree, field list, field values and
   languages are read from the base environment. The catalog (tracked items,
   tracked fields and desired values) is saved to the `Data` item there.
2. **Across environments.** The app moves content field values between
   your environments:
   - "Set current values" reads a field's current value from another
     environment and, once you save, stores it in the base environment's
     `Data` item.
   - Apply reads the target environment's current values for the preview,
     then writes the desired values stored in the base environment to the
     matching items in the target environment.
   - On first run and conflict resolution, a small `Base` or `Secondary`
     marker item (tenant ID, name, created time) is written to every
     environment.
3. **Reset** deletes the app's module folder in every environment.

The app does not sell or share data with anyone.

## What is stored and where

| Data | Where | Retention |
| --- | --- | --- |
| Catalog: tracked item IDs, paths and names, tracked field IDs and names, sharedness, desired values per environment and language (plain text) | `Data` item under `/sitecore/system/Modules/Marketplace/ContentReconciliation` in the base environment's `master` database | Until you delete it or run Reset |
| Environment markers (tenant ID, name, created time) | `Base` / `Secondary` items in the same folder in every environment | Until you delete them or run Reset |
| Context language preference | Browser cookie `cr_context_language` | One year, or until you clear site data |
| Standard request metadata recorded by the hosting provider (IP address, time, path, user agent) when the app's pages and files are loaded | Vercel | 90 days at most |

The app has no server-side code, so it writes no audit or application logs.
Data stored in your SitecoreAI environments is included in their backups,
serialization, packages and content transfers like any other item.

## Who can access it

- **Data in SitecoreAI:** anyone with read access to
  `/sitecore/system/Modules` in the base environment can read the catalog,
  including all desired values. Access is governed by your SitecoreAI roles
  and your agreement with Sitecore. The publisher has no access.
- **Browser cookie:** only you, on your own device.
- **Hosting request metadata:** the app's maintainer and the hosting
  provider, for operating and securing the app.

## How data is protected

- All traffic uses HTTPS (TLS 1.2 or later) with HSTS.
- Every call to SitecoreAI goes through the Marketplace SDK with your own
  session and permissions; the app holds no credentials of its own.
- Security headers restrict which sites may embed the app (SitecoreAI hosts
  only by default).
- Data in SitecoreAI is protected by Sitecore's own at-rest encryption. The
  app does **not** encrypt desired values, which is why secrets must never be
  stored as desired values.
- The tracking view never edits content; only Apply writes to content items,
  and only after a confirmation dialog.

## Sub-processors and third parties

- **Vercel Inc.** (hosting of the static app). Functions, if any, run in the
  United States (region `iad1`, Washington, D.C.) unless a deployment sets
  another region; static files are served from Vercel's edge network. See
  https://vercel.com/legal/privacy-policy.
- **Sitecore** (the SitecoreAI host and APIs), under your own agreement with
  Sitecore.

No analytics, tracking, advertising, font or AI services are used.

## Your rights

Depending on where you live (for example under the GDPR or CCPA), you may
have the right to access, correct, delete, restrict or object to the
processing of your personal data, and to receive a copy of it.

To make a request, email rb205@proton.me with the subject "Data request".
We answer within 30 days. The publisher holds no personal data beyond the
hosting provider's request metadata described above. Data the app stores in
your SitecoreAI environments is under your organization's control; you can
view, change or delete it there directly. You can also complain to your
local data protection authority.

## Deletion

- **Data in SitecoreAI:** open the gear icon and run **Reset** (type
  `RESET`) to delete `/sitecore/system/Modules/Marketplace/ContentReconciliation`
  in every environment, or delete that folder yourself in each environment.
  Uninstalling the app does not delete it.
- **Browser cookie:** clear site data for the app.
- **Hosting request metadata:** deleted automatically after 90 days at most.

## Changes to this policy

We may update this policy from time to time. Changes are published in this
file and reflected in the "Last updated" date at the top.

## Contact

Questions about this policy: email rb205@proton.me or open an issue at
https://github.com/robertobarbedo/sitecoreai-marketplace-content-reconciliation/issues.
