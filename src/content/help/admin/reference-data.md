---
title: Reference Data
description: The catalogs admins maintain, which of them the game reads live, and how to edit them.
badge: For Admins
prevHref: /help/admin/cms-overview
prevLabel: The Admin Console
---

## What reference data is

Reference data is the shared content every nation builds with: component catalogs, archetypes, equipment, diplomatic content, issue templates and personalities. Admins edit it from the admin console, each catalog in its own section (the hub is at `/admin/reference-data`). See [The Admin Console](/help/admin/cms-overview) for access.

## The catalogs

| Catalog | Section | Used by |
| --- | --- | --- |
| National issue templates | `/admin/national-issues` | The issue engine (live) |
| Diplomatic scenarios | `/admin/diplomatic-scenarios` | The Diplomatic Events tab (live) |
| Diplomatic options | `/admin/diplomatic-options` | Choices offered when players edit embassy profiles (live) |
| NPC personalities | `/admin/npc-personalities` | Cultural-exchange participation by computer-run nations |
| Achievements | `/admin/achievements` | Achievement unlocks and rewards (live) |
| Cards and packs | `/admin/cards` | The Vault Shop, packs and card pool (live) |
| Government components | `/admin/government-components` | See the note below |
| Economic components (incl. tax impact) | `/admin/economic-components` | See the note below |
| Economic archetypes | `/admin/economic-archetypes` | See the note below |
| Military equipment | `/admin/military-equipment` | See the note below |

> [!WARNING]
> **Some catalog edits don't reach players yet.** The Country Builder and Editor use a built-in catalog of government components (64), economic components (27) and archetype presets, and the Defense equipment browser uses a built-in equipment list. Edits in the Government components, Economic components, Economic archetypes and Military equipment sections are saved, but players won't see them until those screens are switched over to read the admin catalogs.

## National issue templates

Each template has conditions (when it can appear for a nation), text with placeholders that are filled in from the nation (such as `{{neighborName}}`, `{{ministerName}}`, `{{capitalCity}}`), and response options with typed consequences. The same section sets issue frequency: issues per session, per week, and the spawn mode.

Keep consequences within the game's limits: GDP effects are capped at ±3% per consequence and population effects at ±1%; operations the projection can't represent are dropped.

## Diplomatic scenarios

A scenario has a type (border dispute, trade negotiation and so on), a narrative, response options with risk levels and estimated impacts, the nations involved and an expiry date. Players see active, unexpired scenarios in **Diplomatic Events**. See [Diplomatic Events](/help/diplomacy/scenarios).

## Tips

- Test a new issue template or scenario on a test nation before activating it widely.
- Record significant catalog changes for the other admins; the admin audit log doesn't capture most edits yet.
