---
title: Reference Data
description: The catalogs admins maintain, which of them the game reads live, and which are defined in code.
badge: For Admins
prevHref: /help/admin/cms-overview
prevLabel: The Admin Console
---

## What reference data is

Reference data is the shared content every nation builds with: component catalogs, archetypes, equipment, diplomatic content, issue templates and personalities. Admins manage it from the admin console, each catalog in its own section (the hub is at `/admin/reference-data`). See [The Admin Console](/help/admin/cms-overview) for access.

## The catalogs

| Catalog | Section | Used by |
| --- | --- | --- |
| National issue templates | `/admin/national-issues` | The issue engine (live) |
| Diplomatic scenarios | `/admin/diplomatic-scenarios` | The Diplomatic Events tab (live) |
| Diplomatic options | `/admin/diplomatic-options` | Choices offered when players edit embassy profiles (live) |
| NPC personalities | `/admin/npc-personalities` | Cultural-exchange participation by computer-run nations |
| Achievements | `/admin/achievements` | Achievement unlocks and rewards (live) |
| Cards and packs | `/admin/cards` | The Vault Shop, packs and card pool (live) |
| Economic archetypes | `/admin/economic-archetypes` | The archetype picker in the Country Builder (live) |
| Military equipment | `/admin/military-equipment` | The equipment browser in Defense → Forces & Arsenal (live) |
| Government components | `/admin/government-components` | Read-only: defined in code |
| Economic components (incl. tax impact) | `/admin/economic-components` | Read-only: defined in code |

## Economic archetypes

Archetypes are the presets players can start an economy from. The builder's archetype picker reads this catalog, so a new or edited archetype shows up for players, and deactivating one hides it from the picker. Applying an archetype fills in its economic and government components, tax rates, growth and employment figures; nations already built from it keep what they had.

The first time the catalog is opened it's filled with the 20 built-in archetypes (10 modern, 10 historical), which you can then edit. Use component keys (such as `FREE_MARKET_SYSTEM`) in the component lists; the form offers them.

## Military equipment

The equipment browser players use to add assets in [Defense](/help/defense/equipment) lists the active items in this catalog, with their manufacturer, era, cost, technology level and image. Adding, editing or deactivating an item changes what players can pick from. Loading an item fills in a new asset's details; assets already in a nation's arsenal don't change.

The first time the catalog is opened it's filled with the built-in equipment and manufacturers, which you can then edit. If the catalog can't be read, the browser falls back to the built-in list.

## Government and economic components

The government components (64) and economic components (27) are defined in code, and the Country Builder, the editor and the simulation read them from there. Their admin sections are a read-only reference: browse components with their category, effectiveness, complexity and synergies, see how often nations have adopted them, and (for economic components) view the preset templates. Changing a component means a code change and a release, not an admin edit.

## National issue templates

Each template has conditions (when it can appear for a nation), text with placeholders that are filled in from the nation (such as `{{neighborName}}`, `{{ministerName}}`, `{{capitalCity}}`), and response options with typed consequences. The same section sets issue frequency: issues per session, per week, and the spawn mode.

Keep consequences within the game's limits: GDP effects are capped at ±3% per consequence and population effects at ±1%; operations the projection can't represent are dropped.

## Diplomatic scenarios

A scenario has a type (border dispute, trade negotiation and so on), a narrative, response options with risk levels and estimated impacts, the nations involved and an expiry date. Players see active, unexpired scenarios in **Diplomatic Events**. See [Diplomatic Events](/help/diplomacy/scenarios).

## Tips

- Test a new issue template or scenario on a test nation before activating it widely.
- Record significant catalog changes for the other admins; the admin audit log doesn't capture most edits yet.
