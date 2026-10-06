---
title: The Admin Console
description: What each admin area does, who can reach it, and things to know before changing live data.
badge: For Admins
nextHref: /help/admin/reference-data
nextLabel: Reference Data
---

## What the admin console is

The admin console at `/admin` is where platform admins manage players, nations, game catalogs, world events and platform health. It opens on a live dashboard; a sidebar lists the sections. Only accounts with the **admin** or **owner** role (and the configured system owners) can open it; anyone else is sent back to the home page.

## Roles

| Role | Can do |
| --- | --- |
| Owner | Everything; system owners are always owners |
| Admin | The admin console and admin-only actions across the app |
| Member | Normal play |

Assign roles at `/admin/user-roles`. Membership tiers (such as [Premium](/help/getting-started/premium)) are a separate setting at `/admin/membership`.

## The sections

| Area | Sections |
| --- | --- |
| Platform | Dashboard, Platform health (incl. autosave monitor), Logs, Notifications, Discord bot, Facet lab |
| Players and nations | Users, User roles, Membership, Countries (data, roster import, audit, announcements), Realms (realms and the nation-claim queue), Rings audit |
| The living world | Storyteller (world events and event chains), National issues templates, Maps (World Studio, world editor, style editor) |
| Reference data | Government components, Economic components (incl. tax impact), Economic archetypes, Diplomatic options, Diplomatic scenarios, Military equipment, NPC personalities, Intelligence templates. See [Reference Data](/help/admin/reference-data) |
| Vault | Cards (incl. NationStates card import and lore card batches), Vault, Achievements and article awards |
| Community and wiki | ThinkPages, Polls, Blurbs, Stash, WikiOS settings (incl. Loreward weights), Lore scanner, Image repository |
| Labs | MyLeague, Onoma |

## Common tasks

- **Approve a nation claim:** Realms → claims queue.
- **Give someone Premium:** Membership.
- **Run a world event:** Storyteller. Events can add economic effects to the nations they affect; ending an event stops them. See [Crises & World Events](/help/gameplay/world-events).
- **Recalculate stored national figures:** **Force Recalculation** in Platform (the same job that normally runs every few hours).
- **Change issue frequency:** National issues settings (issues per session, per week, and spawn mode).

## Before you change things

> [!WARNING]
> **Admin changes are live immediately, and most aren't logged yet.** The admin audit log records only a few actions (such as creating world events), and most edits have no undo. Make changes deliberately, and note significant ones for the other admins.

- Background jobs (elections, dividends, drift, trending, auction settlement and so on) only run if they're enabled on the server; check with whoever runs the deployment if something isn't updating.
- There is no crisis-event admin panel; use Storyteller for world events.
