---
title: How Your Economy Is Calculated
description: How GDP and population move over time, and which decisions actually change them.
badge: Economy & Government
prevHref: /help/economy/tiers
prevLabel: Economic Tiers
nextHref: /help/economy/tax-system
nextLabel: Taxes & Revenue
---

## The short version

Your nation has a **baseline** (population, GDP per person and growth rates, set when it was created) and a **baseline date**. Your current figures are projected forward from that baseline to today's IxTime date, using your growth rate (capped by your [tier](/help/economy/tiers)) plus any active effects from directives, issues and world events. Total GDP is population × GDP per person.

## GDP per person

Each IxTime year, GDP per person grows by your effective growth rate:

1. Start from your nation's real GDP growth rate (set in the builder).
2. Multiply by the global growth factor (1.0321, set by admins) and by your nation's local growth factor (usually 1).
3. Apply world-event effects that add to or scale the growth rate.
4. Cap it at your tier's maximum (10% for Impoverished down to 0.5% for Extravagant), with a floor of −10%.
5. Above $60,000 per person, damp it further for diminishing returns.

Then **level effects** are applied on top, outside the cap. These come from economy and infrastructure [directives](/help/mycountry/executive) and GDP outcomes of [national issues](/help/gameplay/national-issues). Each shifts GDP by a percentage that phases in (usually over one IxTime year) and then stays. Issue effects are capped at ±3% each.

## Population

Population grows at your population growth rate each IxTime year, plus any population effects from events. Issue outcomes can shift population by up to ±1% each.

## What changes these numbers

| Changes GDP or population | Doesn't change them (today) |
| --- | --- |
| Time passing (growth, capped by tier) | Tax rates |
| Economy and infrastructure directives | Department budget splits |
| GDP and population outcomes of national issues | Trade tariffs and agreements |
| World events run by admins | Government component choices |
| Admin corrections | Defense operations |

Taxes, budgets and components do change other figures: revenue, spending, unemployment, inflation, your government effectiveness and your IxCredit dividend. They just don't feed GDP growth yet.

## When stored figures update

MyCountry always shows the live projection. Rankings, vitality scores and your IxCredit dividend read the figures stored on your nation, which are refreshed every few hours by a background job (when it's enabled on the server) and whenever an admin runs a recalculation. So a ranking can lag your MyCountry figures by a few hours.

## Vitality scores

The four vitality rings on the [MyCountry home page](/help/mycountry/overview):

- **Economic:** mostly GDP per person (compared with $50,000), adjusted by growth.
- **Wellbeing:** population growth and population density.
- **Diplomatic:** your relations, embassies, alliances and treaties, minus embargoes and sanctions against you. See [Foreign Affairs](/help/mycountry/diplomacy#how-your-diplomatic-score-is-calculated).
- **Efficiency:** your government effectiveness score. See [Synergies & Conflicts](/help/government/synergy).

## A worked example

A Developing nation with $20,000 GDP per person and a 6% growth rate: 6% × 1.0321 = 6.19%, under the Developing cap of 7.5%, so it grows 6.19% per IxTime year (about every six real months). After one IxTime year, GDP per person is about $21,240. A Moderate economy directive committed that year adds a further level effect on top, phased in over the year.
