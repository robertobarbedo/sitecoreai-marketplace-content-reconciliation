# SitecoreAI Content Reconciliation

Content transfers between SitecoreAI environments have a classic side
effect: fields that are *supposed* to differ per environment — API keys,
hostnames, connection strings, feature toggles — get overwritten with the
source environment's values. Push a tree from QA to Production and suddenly
Production is pointing at the QA search index.

The **Content Reconciliation** app is a Sitecore Marketplace app that fixes
this once instead of every time. You tell it which fields are
environment-specific and what the correct value is in each environment;
after any transfer, one preview-and-apply pass restores them all.

<!-- Screenshot: Content Reconciliation — tracking view with the content tree -->

## One Base Environment Owns the Data

On first run, the app asks you to pick a **base environment** — the one
that stores the reconciliation data and provides the content tree you track
items from. Production is the natural choice. Every other environment is
marked as a secondary, so any session in any environment finds the same
dataset.

The choice is permanent (only a full reset changes it), and the app detects
misconfigurations on startup: no base yet gets the setup screen, two bases
get a conflict-resolution screen — it never guesses.

<!-- Screenshot: first-run setup — base environment selection -->

## Configure Reconciliation

The first tab is where you build the catalog of environment-specific
fields:

- **Browse** the base environment's content tree and mark an item with
  "Track this item for reconciliation"
- **Track fields** on it — content fields and system fields are listed
  separately, straight from the item's template
- **Capture the desired value** of each tracked field for every
  environment, per language — or a single value when the field is shared
  across languages

The value semantics are explicit: a value left *not set* is skipped on
apply, while a deliberately *empty* value (there's a "set empty" button)
clears the field. So you can reconcile three fields in Production and only
one of them in QA, without side effects.

<!-- Screenshot: Configure reconciliation — field grid with per-environment values -->

💡 The tracking view never touches live content. You can browse, track, and
edit desired values all day — nothing is written to any item until you
apply. Saving stores the catalog itself, and even that is explicit: a dirty
indicator, a Save button, and a conflict check in case a colleague saved
from another session first.

## Preview and Apply Changes

The second tab is the payoff. Pick a target environment and the app builds
a plan: every stored desired value for that environment, side by side with
the field's **current** value, each row labeled *will update*, *unchanged*,
*item missing*, or *no version*. Nothing is a surprise — you see exactly
what will be written before confirming.

Run the apply and each row reports its own result, so a single failed field
doesn't hide behind a green checkmark.

<!-- Screenshot: Preview and apply — plan with will update / unchanged rows -->

## Better Together with the Content Transfer Console

Reconciliation exists because of content transfers, so it plugs into the
**Content Transfer Console**
<!-- TODO: link to the Content Transfer Console blog post -->:

- The console's **Reconciliation** tab reads this app's data and offers the
  same preview-and-apply view right where the transfers happen
- A **Saved Transfer** can opt in to "Reconcile at the end" — transfer the
  content, then restore the destination's environment-specific values, in
  one run

Define the desired values once here; consume them from either app.

## Under the Hood

A few design choices worth knowing:

- **No credentials to configure.** Everything runs through the Marketplace
  SDK's authoring GraphQL — the app talks to your environments with your
  own SitecoreAI session, and there are no client IDs or secrets to store.
- **The data lives in your content tree.** The whole catalog is one JSON
  document under `/sitecore/system/Modules/Marketplace/ContentReconciliation`
  in the base environment — versioned, backed up, and transferred like any
  other Sitecore content.
- **Shared fields are detected, not assumed.** When you track a field, the
  app reads its definition to see whether it's shared across languages and
  captures one value or one per language accordingly.
- **Apply never trusts stale state.** Right before writing, each item is
  re-fetched from the target environment and the update targets its latest
  version — items missing in the target, or without a version in that
  language, are skipped and reported instead of failing the run.

## How to Set Up

<!-- TODO: setup instructions -->

## TL;DR

- Content Reconciliation is a Marketplace app that restores
  environment-specific field values after a content transfer overwrites
  them.
- Pick a **base environment** once; it stores the catalog and provides the
  tree you track items from.
- Use **Configure reconciliation** to track items and fields and capture
  the desired value per environment and language — not set means skip,
  empty means clear.
- Use **Preview and apply changes** to see current vs. desired for any
  environment and write the fixes with per-field results.
- The Content Transfer Console
  <!-- TODO: link to the Content Transfer Console blog post --> consumes
  the same data, including automatic reconciliation at the end of a saved
  transfer.
